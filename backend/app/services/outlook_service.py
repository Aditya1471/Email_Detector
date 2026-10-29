import hashlib
import hmac
import html
import logging
import secrets
import time
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.config import settings
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.services.indicator_service import indicator_service
from app.services.notification_service import notification_service
from app.services.prediction_service import prediction_service
from app.services.token_encryption_service import token_encryption_service
from app.services.url_analyzer import url_analyzer

logger = logging.getLogger("phishguard.services.outlook")


class OutlookService:
    def __init__(self):
        self.state_secret = settings.jwt_secret.encode()
        self.state_ttl_seconds = 600  # 10 minutes

    def _is_mock_mode(self) -> bool:
        return (
            settings.MICROSOFT_CLIENT_ID.startswith("mock-")
            or settings.MICROSOFT_CLIENT_SECRET.startswith("mock-")
            or settings.APP_ENV != "production"
        )

    # ----------------------------------------------------------------------
    # OAuth 2.0 State & Authorization
    # ----------------------------------------------------------------------
    def generate_authorization_url(self, user_id: uuid.UUID) -> str:
        """
        Generates a secure Microsoft OAuth 2.0 authorization URL with signed state.
        """
        if self._is_mock_mode():
            return f"{settings.MICROSOFT_REDIRECT_URI}?code=mock_ms_auth_code_12345&state={self._create_state(user_id)}"

        state = self._create_state(user_id)
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "response_mode": "query",
            "scope": settings.MICROSOFT_SCOPES,
            "state": state,
            "prompt": "consent",
        }
        return f"{settings.MICROSOFT_AUTHORITY}/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"

    def _create_state(self, user_id: uuid.UUID) -> str:
        timestamp = int(time.time())
        nonce = secrets.token_hex(8)
        payload = f"outlook:{user_id}:{timestamp}:{nonce}"
        signature = hmac.new(self.state_secret, payload.encode(), hashlib.sha256).hexdigest()
        return f"{payload}:{signature}"

    def verify_state(self, state: str) -> Optional[uuid.UUID]:
        """
        Verifies the HMAC signature, provider prefix, and expiration of OAuth state.
        """
        try:
            parts = state.split(":")
            if len(parts) != 5:
                return None
            provider, user_id_str, ts_str, nonce, signature = parts
            if provider != "outlook":
                return None

            payload = f"{provider}:{user_id_str}:{ts_str}:{nonce}"
            expected_sig = hmac.new(self.state_secret, payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected_sig):
                return None

            ts = int(ts_str)
            if time.time() - ts > self.state_ttl_seconds:
                return None

            return uuid.UUID(user_id_str)
        except Exception:
            return None

    # ----------------------------------------------------------------------
    # Token Exchange & Refresh
    # ----------------------------------------------------------------------
    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchanges authorization code for Microsoft Graph access and refresh tokens.
        """
        if self._is_mock_mode() and code.startswith("mock_"):
            return {
                "access_token": f"mock_ms_access_token_{secrets.token_hex(16)}",
                "refresh_token": f"mock_ms_refresh_token_{secrets.token_hex(16)}",
                "expires_in": 3600,
                "token_type": "Bearer",
                "scope": settings.MICROSOFT_SCOPES,
            }

        token_url = f"{settings.MICROSOFT_AUTHORITY}/oauth2/v2.0/token"
        payload = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "scope": settings.MICROSOFT_SCOPES,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(token_url, data=payload)
            if res.status_code != 200:
                raise ValueError("Failed to exchange code with Microsoft Identity platform.")
            return res.json()

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refreshes an expired Microsoft Graph access token.
        """
        if self._is_mock_mode() and refresh_token.startswith("mock_"):
            return {
                "access_token": f"mock_ms_refreshed_access_{secrets.token_hex(16)}",
                "refresh_token": refresh_token,
                "expires_in": 3600,
                "token_type": "Bearer",
            }

        token_url = f"{settings.MICROSOFT_AUTHORITY}/oauth2/v2.0/token"
        payload = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": settings.MICROSOFT_SCOPES,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(token_url, data=payload)
            if res.status_code != 200:
                raise ValueError("Failed to refresh Microsoft Graph access token.")
            return res.json()

    # ----------------------------------------------------------------------
    # User Profile & Mailbox Access
    # ----------------------------------------------------------------------
    async def get_user_profile(self, access_token: str) -> Dict[str, str]:
        """
        Retrieves the signed-in user's Microsoft Graph profile (GET /v1.0/me).
        Returns stable 'provider_account_id' (Microsoft user ID) and 'email_address'.
        """
        if self._is_mock_mode() and access_token.startswith("mock_"):
            return {
                "provider_account_id": "ms-user-id-mock-12345678",
                "email_address": "aditya.outlook.demo@outlook.com",
                "display_name": "Aditya Demo",
            }

        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get("https://graph.microsoft.com/v1.0/me", headers=headers)
            if res.status_code != 200:
                raise ValueError("Failed to fetch Microsoft Graph user profile.")
            data = res.json()
            # Requirement 1: Use stable Microsoft Graph user ID as provider_account_id
            return {
                "provider_account_id": data.get("id", ""),
                "email_address": data.get("mail") or data.get("userPrincipalName", ""),
                "display_name": data.get("displayName", ""),
            }

    async def list_inbox_messages(self, access_token: str, max_messages: int = 20) -> List[Dict[str, Any]]:
        """
        Fetches bounded recent Inbox messages using Microsoft Graph JSON endpoints.
        """
        if self._is_mock_mode() and access_token.startswith("mock_"):
            return [
                {
                    "id": "ms_msg_mock_001",
                    "subject": "Microsoft 365: Urgent Password Reset Required",
                    "from": {"emailAddress": {"address": "security-alert@micros0ft-verify.com", "name": "Security Support"}},
                    "receivedDateTime": datetime.now(timezone.utc).isoformat(),
                    "bodyPreview": "Your Microsoft password will expire in 2 hours. Click here to verify your identity.",
                    "body": {
                        "contentType": "html",
                        "content": (
                            "<p>Your Microsoft password will expire in 2 hours. "
                            "<a href='http://micros0ft-verify.com/login'>Click here to verify</a></p>"
                        ),
                    },
                },
                {
                    "id": "ms_msg_mock_002",
                    "subject": "Weekly Team Project Status",
                    "from": {"emailAddress": {"address": "manager@company.org", "name": "Project Lead"}},
                    "receivedDateTime": datetime.now(timezone.utc).isoformat(),
                    "bodyPreview": "Here is the sprint summary for this week. Great job everyone!",
                    "body": {
                        "contentType": "text",
                        "content": "Here is the sprint summary for this week. Great job everyone!",
                    },
                },
            ][:max_messages]

        url = "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages"
        params = {
            "$top": max_messages,
            "$select": "id,subject,from,receivedDateTime,bodyPreview,body",
            "$orderby": "receivedDateTime desc",
        }
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=headers, params=params)
            if res.status_code != 200:
                raise ValueError(f"Microsoft Graph API error ({res.status_code}) listing messages.")
            return res.json().get("value", [])

    # ----------------------------------------------------------------------
    # Synchronization & In-Memory Analysis
    # ----------------------------------------------------------------------
    async def sync_user_outlook(
        self,
        db: Session,
        user: User,
        integration: EmailIntegration,
        max_messages: int = 20,
    ) -> Dict[str, Any]:
        """
        Synchronizes recent Outlook inbox messages, extracts indicators in memory,
        executes ML prediction, persists privacy-safe summaries, and checks for high-risk alerts.
        """
        if not integration.is_active:
            raise ValueError("Outlook integration is paused.")

        oauth_token = db.query(OAuthToken).filter(OAuthToken.integration_id == integration.id).first()
        if not oauth_token or not oauth_token.encrypted_access_token:
            raise ValueError("No OAuth credentials found for connected Outlook account.")

        access_token = token_encryption_service.decrypt(oauth_token.encrypted_access_token)

        # Refresh token if nearing expiration
        if oauth_token.is_expired() and oauth_token.encrypted_refresh_token:
            refresh_token = token_encryption_service.decrypt(oauth_token.encrypted_refresh_token)
            new_tokens = await self.refresh_access_token(refresh_token)
            access_token = new_tokens["access_token"]
            oauth_token.encrypted_access_token = token_encryption_service.encrypt(access_token)
            if "expires_in" in new_tokens:
                oauth_token.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=new_tokens["expires_in"])
            db.commit()

        messages = await self.list_inbox_messages(access_token, max_messages=max_messages)

        found_count = len(messages)
        processed_count = 0
        skipped_count = 0
        failed_count = 0
        high_risk_count = 0

        for msg in messages:
            provider_msg_id = msg.get("id")
            if not provider_msg_id:
                skipped_count += 1
                continue

            # Idempotency check: Skip duplicate provider message IDs
            existing = (
                db.query(MonitoredMessage)
                .filter(
                    MonitoredMessage.integration_id == integration.id,
                    MonitoredMessage.provider_message_id == provider_msg_id,
                )
                .first()
            )
            if existing:
                skipped_count += 1
                continue

            try:
                # Extract headers & metadata safely
                subject = msg.get("subject") or "No Subject"
                subject_preview = subject[:100]

                sender_data = msg.get("from", {}).get("emailAddress", {})
                sender_email = sender_data.get("address", "")
                sender_domain = ""
                if "@" in sender_email:
                    sender_domain = sender_email.split("@")[-1].strip().lower()

                # Extract and sanitize body with 50 KB ceiling
                raw_body = ""
                body_obj = msg.get("body", {})
                if isinstance(body_obj, dict):
                    raw_body = body_obj.get("content", "")
                elif isinstance(body_obj, str):
                    raw_body = body_obj

                # Strip HTML safely
                clean_body = ""
                if raw_body:
                    soup = BeautifulSoup(raw_body, "html.parser")
                    clean_body = soup.get_text(separator=" ", strip=True)
                    clean_body = html.unescape(clean_body)
                    # Enforce strict 50 KB in-memory ceiling
                    clean_body = clean_body[:51200]

                # Run URL extraction without network requests
                urls = url_analyzer.analyze_all_urls(clean_body)
                url_count = len(urls)

                # Run heuristic indicators
                indicators = indicator_service.analyze_indicators(
                    sender_email,
                    subject_preview,
                    clean_body,
                    urls,
                )

                # Run ML risk prediction
                classification, risk_score, _ = prediction_service.predict_risk(
                    sender_email,
                    subject_preview,
                    clean_body,
                    indicators,
                )

                now_ts = datetime.now(timezone.utc)

                # Persist privacy-safe monitored message summary (NO raw email bodies stored)
                monitored_msg = MonitoredMessage(
                    integration_id=integration.id,
                    provider_message_id=provider_msg_id,
                    sender_domain=sender_domain,
                    subject_preview=subject_preview,
                    classification=classification,
                    risk_score=risk_score,
                    model_version="v1.2.0",
                    url_count=url_count,
                    indicator_count=len(indicators),
                    notification_sent=False,
                    processed_at=now_ts,
                    created_at=now_ts,
                )
                db.add(monitored_msg)
                db.flush()

                processed_count += 1
                if risk_score >= 70:
                    high_risk_count += 1

                # Trigger high-risk SMS notification if eligible
                try:
                    await notification_service.process_high_risk_alert_if_eligible(db, user, monitored_msg)
                except Exception as alert_err:
                    logger.warning(f"Failed to dispatch high-risk alert for msg {provider_msg_id}: {str(alert_err)}")

            except Exception as e:
                logger.error(f"Error processing Outlook message {provider_msg_id}: {str(e)}")
                failed_count += 1

        integration.last_sync_cursor = datetime.now(timezone.utc).isoformat()
        db.commit()

        return {
            "status": "completed",
            "messages_found": found_count,
            "messages_processed": processed_count,
            "messages_skipped": skipped_count,
            "messages_failed": failed_count,
            "high_risk_count": high_risk_count,
            "last_sync_at": integration.last_sync_cursor,
        }

    # ----------------------------------------------------------------------
    # Microsoft Graph Subscription & Webhook Lifecycle
    # ----------------------------------------------------------------------
    async def create_subscription(self, access_token: str, webhook_url: str, client_state: str) -> Dict[str, Any]:
        """
        Creates a Microsoft Graph change-notification subscription for Inbox messages.
        """
        if self._is_mock_mode() and access_token.startswith("mock_"):
            expiry = datetime.now(timezone.utc) + timedelta(minutes=4200)
            return {
                "id": f"sub_mock_ms_{secrets.token_hex(8)}",
                "resource": "me/mailFolders('Inbox')/messages",
                "changeType": "created",
                "notificationUrl": webhook_url,
                "expirationDateTime": expiry.isoformat(),
                "clientState": client_state,
            }

        url = "https://graph.microsoft.com/v1.0/subscriptions"
        expiry = datetime.now(timezone.utc) + timedelta(minutes=4200)
        payload = {
            "changeType": "created",
            "notificationUrl": webhook_url,
            "resource": "me/mailFolders('Inbox')/messages",
            "expirationDateTime": expiry.isoformat(),
            "clientState": client_state,
        }
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code not in (200, 201):
                raise ValueError(f"Failed to create Microsoft Graph subscription: {res.text}")
            return res.json()

    async def renew_subscription(self, access_token: str, subscription_id: str) -> Dict[str, Any]:
        """
        Renews an existing Microsoft Graph subscription.
        """
        if self._is_mock_mode() and access_token.startswith("mock_"):
            new_expiry = datetime.now(timezone.utc) + timedelta(minutes=4200)
            return {
                "id": subscription_id,
                "expirationDateTime": new_expiry.isoformat(),
            }

        url = f"https://graph.microsoft.com/v1.0/subscriptions/{subscription_id}"
        new_expiry = datetime.now(timezone.utc) + timedelta(minutes=4200)
        payload = {"expirationDateTime": new_expiry.isoformat()}
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.patch(url, headers=headers, json=payload)
            if res.status_code != 200:
                raise ValueError(f"Failed to renew Microsoft Graph subscription: {res.text}")
            return res.json()

    async def delete_subscription(self, access_token: str, subscription_id: str) -> bool:
        """
        Deletes a Microsoft Graph subscription.
        """
        if self._is_mock_mode() and access_token.startswith("mock_"):
            return True

        url = f"https://graph.microsoft.com/v1.0/subscriptions/{subscription_id}"
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.delete(url, headers=headers)
            return res.status_code == 204


outlook_service = OutlookService()

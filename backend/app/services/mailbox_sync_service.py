import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.user import User
from app.services.email_parser import email_parser
from app.services.gmail_service import gmail_oauth_service
from app.services.indicator_service import indicator_service
from app.services.notification_service import notification_service
from app.services.prediction_service import prediction_service
from app.services.token_encryption_service import token_encryption_service
from app.services.url_analyzer import url_analyzer

logger = logging.getLogger("phishguard.services.sync")

GMAIL_MESSAGES_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages"


class MailboxSyncService:
    """
    Orchestrates manual synchronization of recent Gmail Inbox messages,
    runs explainable ML phishing detection in memory, and persists privacy-preserving summaries.
    """

    async def list_inbox_messages(
        self,
        access_token: str,
        query: Optional[str] = None,
        max_results: Optional[int] = None,
    ) -> List[Dict[str, str]]:
        """
        Retrieves a list of recent message identifiers from Gmail Inbox matching query parameters.
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {
            "q": query or settings.GMAIL_SYNC_QUERY,
            "maxResults": max_results or settings.GMAIL_SYNC_MAX_MESSAGES,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(GMAIL_MESSAGES_ENDPOINT, headers=headers, params=params)

            if response.status_code == 401:
                raise PermissionError("Access token expired or unauthorized.")
            if response.status_code != 200:
                logger.error(f"Gmail list messages failed ({response.status_code}): {response.text}")
                raise ValueError("Failed to retrieve messages from Gmail API.")

            data = response.json()
            return data.get("messages", [])

    async def fetch_message_detail(self, access_token: str, message_id: str) -> Dict[str, Any]:
        """
        Fetches message payload structure for a specific message ID from the Gmail API.
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        url = f"{GMAIL_MESSAGES_ENDPOINT}/{message_id}"
        params = {"format": "full"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=headers, params=params)

            if response.status_code == 401:
                raise PermissionError("Access token expired or unauthorized.")
            if response.status_code != 200:
                logger.error(f"Gmail fetch message {message_id} failed ({response.status_code}): {response.text}")
                raise ValueError(f"Failed to fetch message details for {message_id}.")

            return response.json()

    async def sync_user_gmail(
        self,
        db: Session,
        user: User,
        integration: EmailIntegration,
    ) -> Dict[str, Any]:
        """
        Executes manual synchronization for the connected Gmail integration:
        1. Decrypts and verifies access/refresh tokens.
        2. Retrieves recent inbox message IDs.
        3. Filters out duplicate/already processed message IDs.
        4. Analyzes new messages in memory and saves privacy-conscious summaries.
        5. Updates sync cursor and returns structured results.
        """
        if not integration.is_active:
            raise ValueError("Gmail monitoring is currently paused. Please resume monitoring before checking for new emails.")

        if not integration.oauth_token or not integration.oauth_token.encrypted_access_token:
            raise ValueError("No OAuth credentials found for this integration. Please reconnect your Gmail account.")

        # 1. Decrypt credentials
        access_token = token_encryption_service.decrypt(integration.oauth_token.encrypted_access_token)
        refresh_token = (
            token_encryption_service.decrypt(integration.oauth_token.encrypted_refresh_token)
            if integration.oauth_token.encrypted_refresh_token
            else None
        )

        # 2. Retrieve recent message IDs with auto-token refresh on 401
        try:
            raw_messages = await self.list_inbox_messages(access_token)
        except PermissionError:
            if not refresh_token:
                raise ValueError("Gmail authorization has expired. Please reconnect your account.")
            logger.info("Access token expired. Attempting token refresh...")
            try:
                new_token_data = await gmail_oauth_service.refresh_access_token(refresh_token)
                access_token = new_token_data["access_token"]
                integration.oauth_token.encrypted_access_token = token_encryption_service.encrypt(access_token)
                db.commit()
                # Retry message list
                raw_messages = await self.list_inbox_messages(access_token)
            except Exception as e:
                logger.error(f"Failed to refresh Gmail token: {str(e)}")
                raise ValueError("Gmail authorization has expired or was revoked. Please reconnect your account.")

        messages_found = len(raw_messages)
        if messages_found == 0:
            now = datetime.now(timezone.utc)
            integration.last_sync_cursor = now.isoformat()
            integration.updated_at = now
            db.commit()
            return {
                "integration_id": integration.id,
                "status": "no_new_messages",
                "messages_found": 0,
                "messages_processed": 0,
                "messages_skipped": 0,
                "messages_failed": 0,
                "high_risk_count": 0,
                "last_sync_at": now,
                "recent_messages": [],
            }

        # 3. Identify already processed message IDs to ensure idempotency
        existing_msg_ids = {
            row[0]
            for row in db.query(MonitoredMessage.provider_message_id)
            .filter(MonitoredMessage.integration_id == integration.id)
            .all()
        }

        messages_processed = 0
        messages_skipped = 0
        messages_failed = 0
        high_risk_count = 0
        recent_summaries: List[Dict[str, Any]] = []

        # 4. Process each new message in memory
        for msg_item in raw_messages:
            msg_id = msg_item.get("id")
            if not msg_id:
                continue

            if msg_id in existing_msg_ids:
                messages_skipped += 1
                continue

            try:
                msg_dict = await self.fetch_message_detail(access_token, msg_id)
                parsed = email_parser.parse_gmail_message_payload(msg_dict)

                # Run URL extraction & analysis
                urls = url_analyzer.analyze_all_urls(parsed["body"])

                # Run heuristic indicators
                indicators = indicator_service.analyze_indicators(
                    parsed["sender"],
                    parsed["subject"],
                    parsed["body"],
                    urls,
                )

                # Run ML risk prediction
                classification, risk_score, confidence = prediction_service.predict_risk(
                    parsed["sender"],
                    parsed["subject"],
                    parsed["body"],
                    indicators,
                )

                now_ts = datetime.now(timezone.utc)

                # Persist privacy-conscious summary (NO complete bodies stored)
                monitored_msg = MonitoredMessage(
                    integration_id=integration.id,
                    provider_message_id=msg_id,
                    sender_domain=parsed["sender_domain"],
                    subject_preview=parsed["subject_preview"],
                    classification=classification,
                    risk_score=risk_score,
                    model_version="v1.2.0",
                    url_count=len(urls),
                    indicator_count=len(indicators),
                    notification_sent=False,
                    processed_at=now_ts,
                    created_at=now_ts,
                )
                db.add(monitored_msg)
                db.flush()

                # Process high-risk SMS alert if user opted in and threshold met
                try:
                    await notification_service.process_high_risk_alert_if_eligible(db, user, monitored_msg)
                except Exception as alert_err:
                    logger.warning(f"Failed to dispatch high-risk alert for msg {msg_id}: {str(alert_err)}")

                if risk_score >= 70:
                    high_risk_count += 1

                messages_processed += 1
                recent_summaries.append(
                    {
                        "id": monitored_msg.id,
                        "provider_message_id": msg_id,
                        "sender_domain": parsed["sender_domain"],
                        "subject_preview": parsed["subject_preview"],
                        "classification": classification,
                        "risk_score": risk_score,
                        "url_count": len(urls),
                        "indicator_count": len(indicators),
                        "processed_at": now_ts,
                    }
                )
            except Exception as e:
                logger.error(f"Error processing Gmail message {msg_id}: {str(e)}")
                messages_failed += 1

        now = datetime.now(timezone.utc)
        integration.last_sync_cursor = now.isoformat()
        integration.updated_at = now
        db.commit()

        status_text = "completed"
        if messages_failed > 0 and messages_processed > 0:
            status_text = "partial_failure"
        elif messages_failed > 0 and messages_processed == 0:
            status_text = "failed"
        elif messages_processed == 0 and messages_skipped > 0:
            status_text = "no_new_messages"

        return {
            "integration_id": integration.id,
            "status": status_text,
            "messages_found": messages_found,
            "messages_processed": messages_processed,
            "messages_skipped": messages_skipped,
            "messages_failed": messages_failed,
            "high_risk_count": high_risk_count,
            "last_sync_at": now,
            "recent_messages": recent_summaries,
        }


mailbox_sync_service = MailboxSyncService()

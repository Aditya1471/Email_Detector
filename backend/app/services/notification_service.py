import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.monitored_message import MonitoredMessage
from app.models.notification import Notification
from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.services.token_encryption_service import token_encryption_service

logger = logging.getLogger("phishguard.services.notifications")

E164_REGEX = r"^\+[1-9]\d{6,14}$"


class NotificationService:
    """
    Handles E.164 phone verification via Twilio Verify, SMS preferences,
    explicit opt-in consent tracking, and high-risk phishing alert dispatches.
    """

    @staticmethod
    def validate_e164_phone(phone: str) -> str:
        """
        Validates and standardizes a phone number according to the international E.164 standard (+[country code][number]).
        """
        if not phone:
            raise ValueError("Phone number cannot be empty.")

        cleaned = re.sub(r"[\s\-\(\)]", "", phone.strip())
        if not re.match(E164_REGEX, cleaned):
            raise ValueError("Invalid phone number format. Please provide a valid E.164 international number (e.g., +12025550123).")

        return cleaned

    @staticmethod
    def mask_phone_number(phone: str) -> str:
        """
        Masks the middle digits of an E.164 phone number for privacy-safe display.
        Example: +12025550123 -> +1 ••• ••• 0123
        """
        if not phone or len(phone) < 6:
            return "••••"
        country_prefix = phone[:2]
        last_four = phone[-4:]
        return f"{country_prefix} ••• ••• {last_four}"

    def _is_mock_mode(self) -> bool:
        """
        Determines whether Twilio is configured in mock/development mode.
        """
        sid = settings.TWILIO_ACCOUNT_SID
        return not sid or sid.startswith("ACmock") or settings.APP_ENV != "production"

    async def start_phone_verification(self, phone_number: str) -> Dict[str, Any]:
        """
        Initiates phone verification by sending a one-time passcode via Twilio Verify.
        """
        normalized_phone = self.validate_e164_phone(phone_number)

        if self._is_mock_mode():
            logger.info(f"Initiated mock phone verification for masked phone: {self.mask_phone_number(normalized_phone)}")
            return {
                "status": "pending",
                "phone_number_masked": self.mask_phone_number(normalized_phone),
                "mock_mode": True,
                "message": "Verification code sent (use demo code 123456).",
            }

        url = f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/Verifications"
        data = {"To": normalized_phone, "Channel": "sms"}
        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(url, data=data, auth=auth)
                if response.status_code not in (200, 201):
                    logger.error(f"Twilio Verify start error: {response.text}")
                    raise ValueError("Failed to send verification SMS through provider.")

                res_data = response.json()
                return {
                    "status": res_data.get("status", "pending"),
                    "phone_number_masked": self.mask_phone_number(normalized_phone),
                    "mock_mode": False,
                }
            except httpx.RequestError as e:
                logger.error(f"Network error communicating with Twilio Verify: {str(e)}")
                raise ValueError("Network error contacting verification provider.")

    async def check_phone_verification(self, phone_number: str, code: str) -> bool:
        """
        Verifies the one-time passcode submitted by the user.
        """
        normalized_phone = self.validate_e164_phone(phone_number)
        code = code.strip()

        if not code:
            raise ValueError("Verification code cannot be empty.")

        if self._is_mock_mode():
            # In development/mock mode, allow standard demo codes
            is_valid = code in ("123456", "000000", "888888")
            logger.info(f"Mock verification check for {self.mask_phone_number(normalized_phone)}: approved={is_valid}")
            return is_valid

        url = f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck"
        data = {"To": normalized_phone, "Code": code}
        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(url, data=data, auth=auth)
                if response.status_code != 200:
                    logger.error(f"Twilio Verify check error: {response.text}")
                    return False

                res_data = response.json()
                return res_data.get("status") == "approved"
            except httpx.RequestError as e:
                logger.error(f"Network error during Twilio check: {str(e)}")
                return False

    async def send_sms_alert(self, phone_number: str, message_body: str) -> Dict[str, Any]:
        """
        Sends an SMS message using Twilio Messaging API.
        """
        if self._is_mock_mode():
            mock_sid = f"SMmock_{secrets.token_hex(12)}"
            logger.info(f"Mock SMS dispatched to {self.mask_phone_number(phone_number)}: SID={mock_sid}")
            return {"status": "sent", "provider_message_id": mock_sid, "mock_mode": True}

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        data = {
            "To": phone_number,
            "MessagingServiceSid": settings.TWILIO_MESSAGING_SERVICE_SID,
            "Body": message_body,
        }
        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(url, data=data, auth=auth)
                if response.status_code not in (200, 201):
                    logger.error(f"Twilio SMS send error: {response.text}")
                    return {"status": "failed", "error": "Provider rejected message.", "mock_mode": False}

                res_data = response.json()
                return {
                    "status": "sent",
                    "provider_message_id": res_data.get("sid"),
                    "mock_mode": False,
                }
            except httpx.RequestError as e:
                logger.error(f"Network error sending SMS alert: {str(e)}")
                return {"status": "failed", "error": "Network timeout or provider unreachable."}

    async def process_high_risk_alert_if_eligible(
        self,
        db: Session,
        user: User,
        monitored_message: MonitoredMessage,
    ) -> Optional[Notification]:
        """
        Evaluates whether an SMS alert should be delivered for an analyzed monitored message.
        Enforces user preferences, verified phone status, opt-in consent, threshold boundaries, and idempotency.
        """
        pref = (
            db.query(UserNotificationPreference)
            .filter(UserNotificationPreference.user_id == user.id)
            .first()
        )

        if not pref:
            return None

        # Check eligibility criteria
        if (
            not pref.sms_alerts_enabled
            or not pref.is_phone_verified
            or pref.alerts_paused
            or not pref.encrypted_phone_number
        ):
            return None

        # Check risk score threshold
        if monitored_message.risk_score < pref.risk_threshold:
            return None

        # Idempotency: Prevent duplicate alert for same monitored message and channel
        existing_alert = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.monitored_message_id == monitored_message.id,
                Notification.channel == "sms",
            )
            .first()
        )
        if existing_alert:
            return existing_alert

        # Decrypt phone number in memory
        try:
            plain_phone = token_encryption_service.decrypt(pref.encrypted_phone_number)
        except Exception as e:
            logger.error(f"Failed to decrypt phone number for user {user.id}: {str(e)}")
            return None

        # Compose privacy-conscious, short SMS template (NO email content/links)
        alert_body = (
            f"PhishGuard alert: A newly received email has a high phishing risk (Score: {monitored_message.risk_score}/100). "
            "Open PhishGuard to review warning indicators. Do not click links in the email."
        )

        # Dispatch alert
        dispatch_result = await self.send_sms_alert(plain_phone, alert_body)
        delivery_status = dispatch_result.get("status", "failed")
        provider_sid = dispatch_result.get("provider_message_id")
        failure_reason = dispatch_result.get("error")

        now = datetime.now(timezone.utc)
        notification = Notification(
            user_id=user.id,
            monitored_message_id=monitored_message.id,
            channel="sms",
            status=delivery_status,
            provider_message_id=provider_sid,
            sent_at=now if delivery_status == "sent" else None,
            failure_reason=failure_reason,
            created_at=now,
        )
        db.add(notification)
        monitored_message.notification_sent = (delivery_status == "sent")
        db.commit()
        db.refresh(notification)

        logger.info(f"High-risk alert processed for msg {monitored_message.id}: status={delivery_status}")
        return notification


notification_service = NotificationService()

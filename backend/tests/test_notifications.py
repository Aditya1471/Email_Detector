from datetime import datetime, timezone

import pytest

from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.notification import Notification
from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.services.notification_service import notification_service
from app.services.token_encryption_service import token_encryption_service


@pytest.fixture
def notif_user(db_session):
    user = User(email="notif.user@example.com", password_hash="hash123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def notif_integration(notif_user, db_session):
    integration = EmailIntegration(
        user_id=notif_user.id,
        provider="gmail",
        provider_account_id="notif.user@gmail.com",
        email_address="notif.user@gmail.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.commit()
    db_session.refresh(integration)
    return integration


@pytest.fixture
def verified_preference(notif_user, db_session):
    raw_phone = "+12025550123"
    pref = UserNotificationPreference(
        user_id=notif_user.id,
        encrypted_phone_number=token_encryption_service.encrypt(raw_phone),
        masked_phone_number=notification_service.mask_phone_number(raw_phone),
        is_phone_verified=True,
        sms_alerts_enabled=True,
        risk_threshold=80,
        consent_recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(pref)
    db_session.commit()
    db_session.refresh(pref)
    return pref


def test_e164_phone_validation_valid():
    assert notification_service.validate_e164_phone("+12025550123") == "+12025550123"
    assert notification_service.validate_e164_phone("+44 20 7123 4567") == "+442071234567"
    assert notification_service.validate_e164_phone("+91-98765-43210") == "+919876543210"


def test_e164_phone_validation_invalid():
    with pytest.raises(ValueError, match="Invalid phone number format"):
        notification_service.validate_e164_phone("12025550123")  # missing +

    with pytest.raises(ValueError, match="Invalid phone number format"):
        notification_service.validate_e164_phone("+012345")  # invalid country prefix 0

    with pytest.raises(ValueError, match="Phone number cannot be empty"):
        notification_service.validate_e164_phone("")


def test_mask_phone_number():
    assert notification_service.mask_phone_number("+12025550123") == "+1 ••• ••• 0123"
    assert notification_service.mask_phone_number("+447911123456") == "+4 ••• ••• 3456"
    assert notification_service.mask_phone_number("123") == "••••"


@pytest.mark.anyio
async def test_start_phone_verification_mock():
    res = await notification_service.start_phone_verification("+12025550123")
    assert res["status"] == "pending"
    assert res["mock_mode"] is True
    assert res["phone_number_masked"] == "+1 ••• ••• 0123"


@pytest.mark.anyio
async def test_check_phone_verification_mock():
    # Valid demo codes
    assert await notification_service.check_phone_verification("+12025550123", "123456") is True
    assert await notification_service.check_phone_verification("+12025550123", "000000") is True

    # Invalid code
    assert await notification_service.check_phone_verification("+12025550123", "999999") is False


@pytest.mark.anyio
async def test_send_sms_alert_mock():
    res = await notification_service.send_sms_alert("+12025550123", "PhishGuard test alert")
    assert res["status"] == "sent"
    assert "SMmock_" in res["provider_message_id"]


@pytest.mark.anyio
async def test_process_high_risk_alert_eligible(notif_user, notif_integration, verified_preference, db_session):
    now_ts = datetime.now(timezone.utc)
    msg = MonitoredMessage(
        integration_id=notif_integration.id,
        provider_message_id="msg_high_risk_001",
        sender_domain="bank-phish.xyz",
        subject_preview="Account Alert",
        classification="phishing",
        risk_score=95,  # Above threshold 80
        processed_at=now_ts,
    )
    db_session.add(msg)
    db_session.commit()

    notification = await notification_service.process_high_risk_alert_if_eligible(db_session, notif_user, msg)
    assert notification is not None
    assert notification.status == "sent"
    assert notification.channel == "sms"
    assert notification.user_id == notif_user.id
    assert notification.monitored_message_id == msg.id
    assert msg.notification_sent is True


@pytest.mark.anyio
async def test_process_high_risk_alert_low_risk_suppressed(notif_user, notif_integration, verified_preference, db_session):
    now_ts = datetime.now(timezone.utc)
    msg = MonitoredMessage(
        integration_id=notif_integration.id,
        provider_message_id="msg_low_risk_001",
        sender_domain="newsletter.com",
        subject_preview="Weekly Digest",
        classification="safe",
        risk_score=25,  # Below threshold 80
        processed_at=now_ts,
    )
    db_session.add(msg)
    db_session.commit()

    notification = await notification_service.process_high_risk_alert_if_eligible(db_session, notif_user, msg)
    assert notification is None

    # No notification record created
    notifs = db_session.query(Notification).filter(Notification.user_id == notif_user.id).all()
    assert len(notifs) == 0


@pytest.mark.anyio
async def test_process_high_risk_alert_opted_out_suppressed(notif_user, notif_integration, verified_preference, db_session):
    # Disable SMS alerts
    verified_preference.sms_alerts_enabled = False
    db_session.commit()

    now_ts = datetime.now(timezone.utc)
    msg = MonitoredMessage(
        integration_id=notif_integration.id,
        provider_message_id="msg_phish_optout_001",
        sender_domain="spoof.xyz",
        subject_preview="Urgent Action",
        classification="phishing",
        risk_score=90,
        processed_at=now_ts,
    )
    db_session.add(msg)
    db_session.commit()

    notification = await notification_service.process_high_risk_alert_if_eligible(db_session, notif_user, msg)
    assert notification is None


@pytest.mark.anyio
async def test_process_high_risk_alert_duplicate_idempotency(notif_user, notif_integration, verified_preference, db_session):
    now_ts = datetime.now(timezone.utc)
    msg = MonitoredMessage(
        integration_id=notif_integration.id,
        provider_message_id="msg_idempotent_001",
        sender_domain="spoof.xyz",
        subject_preview="Urgent Action",
        classification="phishing",
        risk_score=88,
        processed_at=now_ts,
    )
    db_session.add(msg)
    db_session.commit()

    # First dispatch
    notif1 = await notification_service.process_high_risk_alert_if_eligible(db_session, notif_user, msg)
    assert notif1 is not None

    # Second dispatch for same message -> returns existing, doesn't duplicate
    notif2 = await notification_service.process_high_risk_alert_if_eligible(db_session, notif_user, msg)
    assert notif2.id == notif1.id

    notifs = db_session.query(Notification).filter(Notification.monitored_message_id == msg.id).all()
    assert len(notifs) == 1


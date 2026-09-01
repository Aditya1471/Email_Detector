import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.notification import Notification
from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.security.jwt import create_access_token
from app.services.notification_service import notification_service
from app.services.token_encryption_service import token_encryption_service

client = TestClient(app)


@pytest.fixture
def user_one(db_session):
    user = User(email="user_one@example.com", password_hash="hashedpass", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_user_one(user_one):
    return create_access_token(subject=str(user_one.id), role=user_one.role)


@pytest.fixture
def user_two(db_session):
    user = User(email="user_two@example.com", password_hash="hashedpass", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_user_two(user_two):
    return create_access_token(subject=str(user_two.id), role=user_two.role)


def test_start_phone_verification_endpoint(user_one, token_user_one, db_session):
    res = client.post(
        "/api/v1/notifications/phone/start-verification",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"phone_number": "+12025550123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "pending"
    assert data["phone_number_masked"] == "+1 ••• ••• 0123"

    # Confirm preference saved with encrypted phone
    pref = db_session.query(UserNotificationPreference).filter(UserNotificationPreference.user_id == user_one.id).first()
    assert pref is not None
    assert pref.is_phone_verified is False
    assert pref.encrypted_phone_number is not None


def test_start_phone_verification_invalid_phone(user_one, token_user_one):
    res = client.post(
        "/api/v1/notifications/phone/start-verification",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"phone_number": "12025550123"},  # Missing leading '+'
    )
    assert res.status_code == 400
    assert "Invalid phone number format" in res.json()["detail"]


def test_check_phone_verification_endpoint_success(user_one, token_user_one, db_session):
    # Initiate first
    client.post(
        "/api/v1/notifications/phone/start-verification",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"phone_number": "+12025550123"},
    )

    # Check with valid mock code
    res = client.post(
        "/api/v1/notifications/phone/check-verification",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"phone_number": "+12025550123", "code": "123456"},
    )
    assert res.status_code == 200
    assert res.json()["is_phone_verified"] is True

    pref = db_session.query(UserNotificationPreference).filter(UserNotificationPreference.user_id == user_one.id).first()
    assert pref.is_phone_verified is True


def test_check_phone_verification_endpoint_invalid_code(user_one, token_user_one):
    client.post(
        "/api/v1/notifications/phone/start-verification",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"phone_number": "+12025550123"},
    )

    res = client.post(
        "/api/v1/notifications/phone/check-verification",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"phone_number": "+12025550123", "code": "999999"},
    )
    assert res.status_code == 400
    assert "Invalid or expired" in res.json()["detail"]


def test_get_preferences_default(user_one, token_user_one):
    res = client.get(
        "/api/v1/notifications/preferences",
        headers={"Authorization": f"Bearer {token_user_one}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_phone_verified"] is False
    assert data["sms_alerts_enabled"] is False
    assert data["risk_threshold"] == 80


def test_update_preferences_enable_sms_without_verification_rejected(user_one, token_user_one, db_session):
    pref = UserNotificationPreference(user_id=user_one.id, is_phone_verified=False)
    db_session.add(pref)
    db_session.commit()

    res = client.patch(
        "/api/v1/notifications/preferences",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"sms_alerts_enabled": True, "consent_accepted": True},
    )
    assert res.status_code == 400
    assert "must verify your phone number" in res.json()["detail"]


def test_update_preferences_enable_sms_with_consent_success(user_one, token_user_one, db_session):
    raw_phone = "+12025550123"
    pref = UserNotificationPreference(
        user_id=user_one.id,
        encrypted_phone_number=token_encryption_service.encrypt(raw_phone),
        masked_phone_number=notification_service.mask_phone_number(raw_phone),
        is_phone_verified=True,
        sms_alerts_enabled=False,
    )
    db_session.add(pref)
    db_session.commit()

    res = client.patch(
        "/api/v1/notifications/preferences",
        headers={"Authorization": f"Bearer {token_user_one}"},
        json={"sms_alerts_enabled": True, "consent_accepted": True, "risk_threshold": 85},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sms_alerts_enabled"] is True
    assert data["risk_threshold"] == 85
    assert data["consent_recorded_at"] is not None


def test_send_test_notification_endpoint(user_one, token_user_one, db_session):
    raw_phone = "+12025550123"
    pref = UserNotificationPreference(
        user_id=user_one.id,
        encrypted_phone_number=token_encryption_service.encrypt(raw_phone),
        masked_phone_number=notification_service.mask_phone_number(raw_phone),
        is_phone_verified=True,
        sms_alerts_enabled=True,
    )
    db_session.add(pref)
    db_session.commit()

    res = client.post(
        "/api/v1/notifications/test",
        headers={"Authorization": f"Bearer {token_user_one}"},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    notifs = db_session.query(Notification).filter(Notification.user_id == user_one.id).all()
    assert len(notifs) == 1
    assert notifs[0].status == "sent"


def test_list_notifications_and_cross_user_isolation(user_one, token_user_one, user_two, token_user_two, db_session):
    notif_1 = Notification(user_id=user_one.id, channel="sms", status="sent")
    db_session.add(notif_1)
    db_session.commit()

    # User 1 sees their notification
    res1 = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token_user_one}"})
    assert res1.status_code == 200
    assert res1.json()["count"] == 1

    # User 2 sees 0 notifications
    res2 = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token_user_two}"})
    assert res2.status_code == 200
    assert res2.json()["count"] == 0


def test_delete_phone_endpoint(user_one, token_user_one, db_session):
    pref = UserNotificationPreference(
        user_id=user_one.id,
        encrypted_phone_number=token_encryption_service.encrypt("+12025550123"),
        masked_phone_number="+1 ••• ••• 0123",
        is_phone_verified=True,
        sms_alerts_enabled=True,
    )
    db_session.add(pref)
    db_session.commit()

    res = client.delete(
        "/api/v1/notifications/phone",
        headers={"Authorization": f"Bearer {token_user_one}"},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    db_session.refresh(pref)
    assert pref.encrypted_phone_number is None
    assert pref.is_phone_verified is False
    assert pref.sms_alerts_enabled is False

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.security.jwt import create_access_token
from app.services.notification_service import notification_service
from app.services.token_encryption_service import token_encryption_service
from app.tasks.gmail_tasks import execute_sync_gmail_job
from app.tasks.notification_tasks import execute_send_high_risk_sms_job

client = TestClient(app)


@pytest.fixture
def async_user(db_session):
    user = User(email="async_sync_user@example.com", password_hash="hashedpass", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def async_token(async_user):
    return create_access_token(subject=str(async_user.id), role=async_user.role)


@pytest.fixture
def async_integration(async_user, db_session):
    integration = EmailIntegration(
        user_id=async_user.id,
        provider="gmail",
        provider_account_id="async_sync_user@gmail.com",
        email_address="async_sync_user@gmail.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.flush()

    oauth_token = OAuthToken(
        integration_id=integration.id,
        encrypted_access_token=token_encryption_service.encrypt("valid_token"),
    )
    db_session.add(oauth_token)
    db_session.commit()
    db_session.refresh(integration)
    return integration


def test_sync_endpoint_returns_http_202_with_job_id(async_user, async_token, async_integration, db_session):
    with patch("app.services.mailbox_sync_service.mailbox_sync_service.sync_user_gmail", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {
            "status": "completed",
            "messages_found": 1,
            "messages_processed": 1,
            "messages_skipped": 0,
            "messages_failed": 0,
            "high_risk_count": 0,
        }

        res = client.post("/api/v1/integrations/gmail/sync", headers={"Authorization": f"Bearer {async_token}"})
        assert res.status_code == 202
        data = res.json()
        assert "job_id" in data
        assert data["message"] == "Email synchronization has been queued."

        # Verify BackgroundJob in database
        job_id = uuid.UUID(data["job_id"])
        job = db_session.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        assert job is not None
        assert job.user_id == async_user.id
        assert job.integration_id == async_integration.id


def test_sync_endpoint_duplicate_job_suppression(async_user, async_token, async_integration, db_session):
    # Pre-create a running job for this integration
    existing_job = BackgroundJob(
        job_type="gmail_sync",
        user_id=async_user.id,
        integration_id=async_integration.id,
        status="running",
    )
    db_session.add(existing_job)
    db_session.commit()

    res = client.post("/api/v1/integrations/gmail/sync", headers={"Authorization": f"Bearer {async_token}"})
    assert res.status_code == 202
    data = res.json()
    assert data["job_id"] == str(existing_job.id)
    assert data["status"] == "running"
    assert "already in progress" in data["message"]


def test_sync_gmail_mailbox_job_task_success(async_user, async_integration, db_session):
    job = BackgroundJob(
        job_type="gmail_sync",
        user_id=async_user.id,
        integration_id=async_integration.id,
        status="queued",
    )
    db_session.add(job)
    db_session.commit()

    mock_result = {
        "status": "completed",
        "messages_found": 3,
        "messages_processed": 3,
        "messages_skipped": 0,
        "messages_failed": 0,
        "high_risk_count": 1,
    }

    with patch("app.services.mailbox_sync_service.mailbox_sync_service.sync_user_gmail", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = mock_result

        result = execute_sync_gmail_job(str(job.id), str(async_integration.id), str(async_user.id), db_session=db_session)
        assert result["messages_processed"] == 3

        db_session.refresh(job)
        assert job.status == "completed"
        assert job.completed_at is not None
        assert job.attempt_count == 1


def test_sync_gmail_mailbox_job_task_integration_paused(async_user, async_integration, db_session):
    async_integration.is_active = False
    db_session.commit()

    job = BackgroundJob(
        job_type="gmail_sync",
        user_id=async_user.id,
        integration_id=async_integration.id,
        status="queued",
    )
    db_session.add(job)
    db_session.commit()

    result = execute_sync_gmail_job(str(job.id), str(async_integration.id), str(async_user.id), db_session=db_session)
    assert result["status"] == "cancelled"

    db_session.refresh(job)
    assert job.status == "cancelled"
    assert job.error_code == "INTEGRATION_PAUSED"


def test_send_high_risk_sms_job_task_success(async_user, async_integration, db_session):
    # Setup verified phone preference
    pref = UserNotificationPreference(
        user_id=async_user.id,
        encrypted_phone_number=token_encryption_service.encrypt("+12025550123"),
        masked_phone_number=notification_service.mask_phone_number("+12025550123"),
        is_phone_verified=True,
        sms_alerts_enabled=True,
        risk_threshold=80,
    )
    db_session.add(pref)

    msg = MonitoredMessage(
        integration_id=async_integration.id,
        provider_message_id="msg_celery_phish_001",
        sender_domain="phish-test.xyz",
        subject_preview="Urgent Account Hold",
        classification="phishing",
        risk_score=95,
    )
    db_session.add(msg)
    db_session.commit()

    result = execute_send_high_risk_sms_job(str(async_user.id), str(msg.id), db_session=db_session)
    assert result["status"] == "sent"
    assert "notification_id" in result

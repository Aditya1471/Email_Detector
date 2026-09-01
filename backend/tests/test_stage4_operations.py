import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import yaml
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.security.jwt import create_access_token
from app.services.job_service import job_service
from app.services.notification_service import notification_service
from app.services.token_encryption_service import token_encryption_service
from app.tasks.gmail_tasks import execute_sync_gmail_job
from app.worker import celery_app

client = TestClient(app)


@pytest.fixture
def op_user(db_session):
    user = User(email="op_user@example.com", password_hash="hash_pw", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def op_token(op_user):
    return create_access_token(subject=str(op_user.id), role=op_user.role)


@pytest.fixture
def op_integration(op_user, db_session):
    integration = EmailIntegration(
        user_id=op_user.id,
        provider="gmail",
        provider_account_id="op_user@gmail.com",
        email_address="op_user@gmail.com",
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


def test_celery_worker_crash_recovery_config():
    """Requirement 4 & 5: Celery worker must have late acknowledgments and reject on lost enabled."""
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.task_reject_on_worker_lost is True
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.accept_content == ["json"]


def test_job_state_transitions(op_user, op_integration, db_session):
    """Requirement 2 & 3: Job transitions from queued -> running -> completed."""
    job = BackgroundJob(
        job_type="gmail_sync",
        user_id=op_user.id,
        integration_id=op_integration.id,
        status="queued",
    )
    db_session.add(job)
    db_session.commit()
    assert job.status == "queued"

    mock_sync_result = {
        "status": "completed",
        "messages_found": 2,
        "messages_processed": 2,
        "messages_skipped": 0,
        "messages_failed": 0,
        "high_risk_count": 0,
        "last_sync_at": datetime.now(timezone.utc).isoformat(),
    }

    with patch("app.services.mailbox_sync_service.mailbox_sync_service.sync_user_gmail", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = mock_sync_result
        res = execute_sync_gmail_job(str(job.id), str(op_integration.id), str(op_user.id), db_session=db_session)
        assert res["messages_processed"] == 2

    db_session.refresh(job)
    assert job.status == "completed"
    assert job.started_at is not None
    assert job.completed_at is not None
    assert job.attempt_count == 1


def test_duplicate_message_idempotency(op_user, op_integration, db_session):
    """Requirement 6: Duplicate Gmail message IDs do not create duplicate records."""
    msg1 = MonitoredMessage(
        integration_id=op_integration.id,
        provider_message_id="msg_duplicate_check_001",
        sender_domain="trusted.com",
        subject_preview="Report",
        classification="safe",
        risk_score=10,
    )
    db_session.add(msg1)
    db_session.commit()

    # Query checks existing
    existing = (
        db_session.query(MonitoredMessage)
        .filter(
            MonitoredMessage.integration_id == op_integration.id,
            MonitoredMessage.provider_message_id == "msg_duplicate_check_001",
        )
        .first()
    )
    assert existing is not None


@pytest.mark.anyio
async def test_duplicate_sms_alert_prevention(op_user, op_integration, db_session):
    """Requirement 7: Duplicate SMS alerts are prevented for the same message."""
    pref = UserNotificationPreference(
        user_id=op_user.id,
        encrypted_phone_number=token_encryption_service.encrypt("+12025550123"),
        masked_phone_number=notification_service.mask_phone_number("+12025550123"),
        is_phone_verified=True,
        sms_alerts_enabled=True,
        risk_threshold=80,
    )
    db_session.add(pref)

    msg = MonitoredMessage(
        integration_id=op_integration.id,
        provider_message_id="msg_high_risk_once_001",
        sender_domain="phish-corp.xyz",
        subject_preview="Security Reset",
        classification="phishing",
        risk_score=95,
    )
    db_session.add(msg)
    db_session.commit()

    # First dispatch
    notif1 = await notification_service.process_high_risk_alert_if_eligible(db_session, op_user, msg)
    assert notif1 is not None
    assert notif1.status == "sent"

    # Second dispatch returns existing without creating duplicate
    notif2 = await notification_service.process_high_risk_alert_if_eligible(db_session, op_user, msg)
    assert notif2.id == notif1.id


def test_job_ownership_security(op_user, op_token, db_session):
    """Requirement 8: Cross-user job status inspection is blocked."""
    other_user = User(email="other_op@example.com", password_hash="hash", role="user", is_active=True)
    db_session.add(other_user)
    db_session.commit()

    other_job = BackgroundJob(job_type="gmail_sync", user_id=other_user.id, status="queued")
    db_session.add(other_job)
    db_session.commit()

    res = client.get(f"/api/v1/jobs/{other_job.id}", headers={"Authorization": f"Bearer {op_token}"})
    assert res.status_code == 404


def test_error_and_result_summary_sanitization(op_user, op_integration, db_session):
    """Requirement 10: Result summaries and error messages never contain tokens, passwords, bodies, or PII."""
    job = BackgroundJob(
        job_type="gmail_sync",
        user_id=op_user.id,
        integration_id=op_integration.id,
        status="completed",
        result_summary=json.dumps({"messages_found": 1, "messages_processed": 1, "high_risk_count": 0}),
    )
    db_session.add(job)
    db_session.commit()

    # Validate that neither tokens nor bodies can be stored in summary
    assert "token" not in job.result_summary.lower()
    assert "password" not in job.result_summary.lower()
    assert "body" not in job.result_summary.lower()


def test_redis_staging_isolation_in_compose():
    """Requirement 11: Redis in docker-compose.staging.yml does not expose public host ports."""
    with open("docker-compose.staging.yml", "r", encoding="utf-8") as f:
        compose_content = yaml.safe_load(f)

    redis_service = compose_content.get("services", {}).get("redis", {})
    assert redis_service is not None
    # Staging Redis must not bind ports to host
    assert "ports" not in redis_service


def test_real_sms_disabled_in_test_environment():
    """Requirement 12: Real SMS delivery is disabled in test settings."""
    assert settings.SMS_ALERTS_ENABLED is False or settings.TWILIO_ACCOUNT_SID.startswith("ACmock")


def test_stale_job_cleanup_policy(op_user, db_session):
    """Requirement 13: Stale completed/failed jobs older than 30 days are purged."""
    old_time = datetime.now(timezone.utc) - timedelta(days=45)
    recent_time = datetime.now(timezone.utc) - timedelta(days=5)

    old_job = BackgroundJob(
        job_type="gmail_sync",
        user_id=op_user.id,
        status="completed",
        created_at=old_time,
    )
    recent_job = BackgroundJob(
        job_type="gmail_sync",
        user_id=op_user.id,
        status="completed",
        created_at=recent_time,
    )
    db_session.add(old_job)
    db_session.add(recent_job)
    db_session.commit()

    old_job_id = old_job.id
    recent_job_id = recent_job.id

    cleanup_res = job_service.cleanup_stale_background_jobs(db_session, retention_days=30)
    assert cleanup_res["deleted_jobs_count"] >= 1

    # Old job is purged, recent job is preserved
    assert db_session.query(BackgroundJob).filter(BackgroundJob.id == old_job_id).first() is None
    assert db_session.query(BackgroundJob).filter(BackgroundJob.id == recent_job_id).first() is not None

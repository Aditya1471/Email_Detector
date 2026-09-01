import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.services.token_encryption_service import token_encryption_service

client = TestClient(app)


@pytest.fixture
def webhook_user(db_session):
    user = User(email="webhook_user@example.com", password_hash="hash_pw", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def webhook_integration(webhook_user, db_session):
    integration = EmailIntegration(
        user_id=webhook_user.id,
        provider="outlook",
        provider_account_id="ms-webhook-account-123",
        email_address="webhook_user@outlook.com",
        subscription_id="sub_test_12345",
        is_active=True,
    )
    db_session.add(integration)
    db_session.flush()

    oauth_token = OAuthToken(
        integration_id=integration.id,
        encrypted_access_token=token_encryption_service.encrypt("mock_token"),
    )
    db_session.add(oauth_token)
    db_session.commit()
    db_session.refresh(integration)
    return integration


def test_webhook_validation_token_challenge_returns_plain_text():
    """Requirement 12: Microsoft Graph validation challenge returns plain text validation token."""
    challenge_token = "abc123xyzValidationToken456"
    res = client.post(f"/api/v1/integrations/outlook/webhook?validationToken={challenge_token}")
    assert res.status_code == 200
    assert res.text == challenge_token
    assert "text/plain" in res.headers["content-type"]


def test_webhook_notification_invalid_client_state_rejected(webhook_integration, db_session):
    """Requirement 12: Webhook rejects notifications with invalid clientState."""
    payload = {
        "value": [
            {
                "subscriptionId": webhook_integration.subscription_id,
                "clientState": "wrong-client-state",
                "changeType": "created",
                "resource": "me/mailFolders('Inbox')/messages",
            }
        ]
    }
    res = client.post("/api/v1/integrations/outlook/webhook", json=payload)
    assert res.status_code == 202

    # No job queued because clientState was invalid
    jobs = db_session.query(BackgroundJob).filter(BackgroundJob.integration_id == webhook_integration.id).all()
    assert len(jobs) == 0


def test_webhook_notification_enqueues_sync_job(webhook_integration, db_session):
    """Requirement 12: Valid change notification enqueues background sync job."""
    payload = {
        "value": [
            {
                "subscriptionId": webhook_integration.subscription_id,
                "clientState": settings.MICROSOFT_WEBHOOK_CLIENT_STATE,
                "changeType": "created",
                "resource": "me/mailFolders('Inbox')/messages",
            }
        ]
    }
    res = client.post("/api/v1/integrations/outlook/webhook", json=payload)
    assert res.status_code == 202

    jobs = db_session.query(BackgroundJob).filter(BackgroundJob.integration_id == webhook_integration.id).all()
    assert len(jobs) >= 1
    assert jobs[0].job_type == "outlook_sync"

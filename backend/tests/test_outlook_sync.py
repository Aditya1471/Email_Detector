import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.security.jwt import create_access_token
from app.services.outlook_service import outlook_service
from app.services.token_encryption_service import token_encryption_service
from app.tasks.outlook_tasks import execute_sync_outlook_job

client = TestClient(app)


@pytest.fixture
def user_outlook(db_session):
    user = User(email="outlook_user@example.com", password_hash="hash_pw", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_outlook(user_outlook):
    return create_access_token(subject=str(user_outlook.id), role=user_outlook.role)


@pytest.fixture
def integration_outlook(user_outlook, db_session):
    integration = EmailIntegration(
        user_id=user_outlook.id,
        provider="outlook",
        provider_account_id="ms-user-id-mock-12345678",
        email_address="aditya.outlook.demo@outlook.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.flush()

    oauth_token = OAuthToken(
        integration_id=integration.id,
        encrypted_access_token=token_encryption_service.encrypt("mock_ms_access_token_123"),
    )
    db_session.add(oauth_token)
    db_session.commit()
    db_session.refresh(integration)
    return integration


def test_outlook_connect_endpoint(token_outlook):
    res = client.get("/api/v1/integrations/outlook/connect", headers={"Authorization": f"Bearer {token_outlook}"})
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "outlook"
    assert "state=" in data["authorization_url"]


def test_outlook_callback_missing_params():
    res = client.get("/api/v1/integrations/outlook/callback", follow_redirects=False)
    assert res.status_code == 307
    assert "error=missing_oauth_parameters" in res.headers["location"]


def test_outlook_callback_success_with_stable_user_id(user_outlook, db_session):
    state = outlook_service._create_state(user_outlook.id)
    res = client.get(f"/api/v1/integrations/outlook/callback?code=mock_code_123&state={state}", follow_redirects=False)
    assert res.status_code == 307
    assert "connected=outlook" in res.headers["location"]

    # Verify integration created with stable Microsoft ID
    integration = db_session.query(EmailIntegration).filter(EmailIntegration.user_id == user_outlook.id, EmailIntegration.provider == "outlook").first()
    assert integration is not None
    assert integration.provider_account_id == "ms-user-id-mock-12345678"
    assert integration.email_address == "aditya.outlook.demo@outlook.com"


def test_outlook_sync_endpoint_unauthenticated():
    res = client.post("/api/v1/integrations/outlook/sync")
    assert res.status_code == 401


def test_outlook_sync_endpoint_returns_http_202(token_outlook, integration_outlook, db_session):
    res = client.post("/api/v1/integrations/outlook/sync", headers={"Authorization": f"Bearer {token_outlook}"})
    assert res.status_code == 202
    data = res.json()
    assert "job_id" in data
    assert data["message"] == "Email synchronization has been queued."


def test_outlook_sync_task_processes_messages_with_deduplication(user_outlook, integration_outlook, db_session):
    job = BackgroundJob(
        job_type="outlook_sync",
        user_id=user_outlook.id,
        integration_id=integration_outlook.id,
        status="queued",
    )
    db_session.add(job)
    db_session.commit()

    # First sync
    result1 = execute_sync_outlook_job(str(job.id), str(integration_outlook.id), str(user_outlook.id), db_session=db_session)
    assert result1["messages_processed"] >= 1

    messages = db_session.query(MonitoredMessage).filter(MonitoredMessage.integration_id == integration_outlook.id).all()
    assert len(messages) >= 1

    # Second sync -> skips duplicates
    job2 = BackgroundJob(
        job_type="outlook_sync",
        user_id=user_outlook.id,
        integration_id=integration_outlook.id,
        status="queued",
    )
    db_session.add(job2)
    db_session.commit()

    result2 = execute_sync_outlook_job(str(job2.id), str(integration_outlook.id), str(user_outlook.id), db_session=db_session)
    assert result2["messages_skipped"] >= 1


def test_outlook_pause_resume_disconnect(token_outlook, integration_outlook, db_session):
    # Pause
    res_pause = client.post("/api/v1/integrations/outlook/pause", headers={"Authorization": f"Bearer {token_outlook}"})
    assert res_pause.status_code == 200
    assert res_pause.json()["integration"]["is_active"] is False

    # Resume
    res_resume = client.post("/api/v1/integrations/outlook/resume", headers={"Authorization": f"Bearer {token_outlook}"})
    assert res_resume.status_code == 200
    assert res_resume.json()["integration"]["is_active"] is True

    # Disconnect
    res_del = client.delete("/api/v1/integrations/outlook", headers={"Authorization": f"Bearer {token_outlook}"})
    assert res_del.status_code == 200
    assert db_session.query(EmailIntegration).filter(EmailIntegration.id == integration_outlook.id).first() is None

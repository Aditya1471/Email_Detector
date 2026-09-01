from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.security.jwt import create_access_token
from app.services.token_encryption_service import token_encryption_service

client = TestClient(app)


@pytest.fixture
def user_a(db_session):
    user = User(email="sync_user_a@example.com", password_hash="hashedpass", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_user_a(user_a):
    return create_access_token(subject=str(user_a.id), role=user_a.role)


@pytest.fixture
def user_b(db_session):
    user = User(email="sync_user_b@example.com", password_hash="hashedpass", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_user_b(user_b):
    return create_access_token(subject=str(user_b.id), role=user_b.role)


@pytest.fixture
def integration_user_a(user_a, db_session):
    integration = EmailIntegration(
        user_id=user_a.id,
        provider="gmail",
        provider_account_id="sync_user_a@gmail.com",
        email_address="sync_user_a@gmail.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.flush()

    oauth_token = OAuthToken(
        integration_id=integration.id,
        encrypted_access_token=token_encryption_service.encrypt("access_token_a"),
    )
    db_session.add(oauth_token)
    db_session.commit()
    db_session.refresh(integration)
    return integration


def test_sync_endpoint_unauthenticated():
    res = client.post("/api/v1/integrations/gmail/sync")
    assert res.status_code == 401


def test_sync_endpoint_not_found(token_user_b):
    # User B has no integration
    res = client.post("/api/v1/integrations/gmail/sync", headers={"Authorization": f"Bearer {token_user_b}"})
    assert res.status_code == 404
    assert "No connected Gmail integration found" in res.json()["detail"]


def test_sync_endpoint_paused(user_a, token_user_a, integration_user_a, db_session):
    integration_user_a.is_active = False
    db_session.commit()

    res = client.post("/api/v1/integrations/gmail/sync", headers={"Authorization": f"Bearer {token_user_a}"})
    assert res.status_code == 400
    assert "currently paused" in res.json()["detail"]


def test_sync_endpoint_success(user_a, token_user_a, integration_user_a):
    mock_sync_result = {
        "integration_id": integration_user_a.id,
        "status": "completed",
        "messages_found": 3,
        "messages_processed": 3,
        "messages_skipped": 0,
        "messages_failed": 0,
        "high_risk_count": 1,
        "last_sync_at": "2026-09-01T12:00:00Z",
        "recent_messages": [],
    }

    with patch("app.services.mailbox_sync_service.mailbox_sync_service.sync_user_gmail", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = mock_sync_result

        res = client.post("/api/v1/integrations/gmail/sync", headers={"Authorization": f"Bearer {token_user_a}"})
        assert res.status_code == 202
        data = res.json()
        assert "job_id" in data
        assert data["message"] == "Email synchronization has been queued."


def test_list_monitored_messages_isolation(user_a, token_user_a, integration_user_a, user_b, token_user_b, db_session):
    # Create message for user A
    msg_a = MonitoredMessage(
        integration_id=integration_user_a.id,
        provider_message_id="msg_user_a_001",
        sender_domain="trusted.com",
        subject_preview="Report for User A",
        classification="safe",
        risk_score=15,
    )
    db_session.add(msg_a)
    db_session.commit()

    # User A requests messages
    res_a = client.get("/api/v1/integrations/messages", headers={"Authorization": f"Bearer {token_user_a}"})
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["count"] == 1
    assert data_a["messages"][0]["provider_message_id"] == "msg_user_a_001"

    # User B requests messages (cross-user isolation, should be empty)
    res_b = client.get("/api/v1/integrations/messages", headers={"Authorization": f"Bearer {token_user_b}"})
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["count"] == 0

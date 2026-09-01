from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.security.jwt import create_access_token
from app.services.gmail_service import gmail_oauth_service
from app.services.token_encryption_service import token_encryption_service

client = TestClient(app)


@pytest.fixture
def test_user(db_session):
    user = User(email="test.integrator@example.com", password_hash="hashedpassword123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def user_token(test_user):
    return create_access_token(subject=str(test_user.id), role=test_user.role)


@pytest.fixture
def other_user(db_session):
    user = User(email="other.integrator@example.com", password_hash="hashedpassword123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def other_user_token(other_user):
    return create_access_token(subject=str(other_user.id), role=other_user.role)


def test_gmail_connect_unauthenticated():
    response = client.get("/api/v1/integrations/gmail/connect")
    assert response.status_code == 401


def test_gmail_connect_authenticated(user_token):
    response = client.get("/api/v1/integrations/gmail/connect", headers={"Authorization": f"Bearer {user_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "gmail"
    assert "authorization_url" in data
    assert "accounts.google.com" in data["authorization_url"]
    assert "gmail.readonly" in data["authorization_url"]


def test_gmail_callback_missing_params():
    response = client.get("/api/v1/integrations/gmail/callback")
    assert response.status_code == 400


def test_gmail_callback_error_redirect():
    response = client.get(
        "/api/v1/integrations/gmail/callback?error=access_denied",
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert "status=error" in response.headers["location"]


def test_gmail_callback_success(test_user, db_session):
    state_token = gmail_oauth_service.generate_authorization_url(test_user.id).split("state=")[1]

    mock_tokens = {
        "access_token": "ya29.mock_access_token_12345",
        "refresh_token": "1//mock_refresh_token_67890",
        "expires_in": 3600,
    }
    mock_profile = {
        "email_address": "verified.user@gmail.com",
        "provider_account_id": "verified.user@gmail.com",
    }

    with (
        patch("app.services.gmail_service.gmail_oauth_service.exchange_code_for_tokens", new_callable=AsyncMock) as mock_exchange,
        patch("app.services.gmail_service.gmail_oauth_service.get_user_profile", new_callable=AsyncMock) as mock_profile_call,
    ):
        mock_exchange.return_value = mock_tokens
        mock_profile_call.return_value = mock_profile

        # Call callback with JSON accept header to inspect JSON response
        response = client.get(
            f"/api/v1/integrations/gmail/callback?code=mock_auth_code&state={state_token}",
            headers={"Accept": "application/json"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["email_address"] == "verified.user@gmail.com"

        # Verify DB records
        integration = db_session.query(EmailIntegration).filter(EmailIntegration.user_id == test_user.id).first()
        assert integration is not None
        assert integration.email_address == "verified.user@gmail.com"
        assert integration.is_active is True

        token_record = db_session.query(OAuthToken).filter(OAuthToken.integration_id == integration.id).first()
        assert token_record is not None
        # Verify access token is encrypted at rest and decryptable
        assert token_record.encrypted_access_token != "ya29.mock_access_token_12345"
        decrypted_access = token_encryption_service.decrypt(token_record.encrypted_access_token)
        assert decrypted_access == "ya29.mock_access_token_12345"


def test_list_integrations_and_isolation(test_user, user_token, other_user, other_user_token, db_session):
    # Create integration for test_user
    integration_a = EmailIntegration(
        user_id=test_user.id,
        provider="gmail",
        provider_account_id="user_a@gmail.com",
        email_address="user_a@gmail.com",
        is_active=True,
    )
    db_session.add(integration_a)
    db_session.commit()

    # User A requests integrations
    response_a = client.get("/api/v1/integrations", headers={"Authorization": f"Bearer {user_token}"})
    assert response_a.status_code == 200
    data_a = response_a.json()
    assert data_a["count"] == 1
    assert data_a["integrations"][0]["email_address"] == "user_a@gmail.com"

    # User B requests integrations (should be empty, cross-user isolation)
    response_b = client.get("/api/v1/integrations", headers={"Authorization": f"Bearer {other_user_token}"})
    assert response_b.status_code == 200
    data_b = response_b.json()
    assert data_b["count"] == 0


def test_pause_and_resume_gmail_integration(test_user, user_token, db_session):
    integration = EmailIntegration(
        user_id=test_user.id,
        provider="gmail",
        provider_account_id="user_pause@gmail.com",
        email_address="user_pause@gmail.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.commit()

    # Pause
    pause_res = client.post("/api/v1/integrations/gmail/pause", headers={"Authorization": f"Bearer {user_token}"})
    assert pause_res.status_code == 200
    assert pause_res.json()["integration"]["is_active"] is False

    # Resume
    resume_res = client.post("/api/v1/integrations/gmail/resume", headers={"Authorization": f"Bearer {user_token}"})
    assert resume_res.status_code == 200
    assert resume_res.json()["integration"]["is_active"] is True


def test_disconnect_gmail_integration(test_user, user_token, db_session):
    integration = EmailIntegration(
        user_id=test_user.id,
        provider="gmail",
        provider_account_id="user_disconnect@gmail.com",
        email_address="user_disconnect@gmail.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.flush()

    token_rec = OAuthToken(
        integration_id=integration.id,
        encrypted_access_token=token_encryption_service.encrypt("test_token"),
    )
    db_session.add(token_rec)
    db_session.commit()

    with patch("app.services.gmail_service.gmail_oauth_service.revoke_token", new_callable=AsyncMock) as mock_revoke:
        mock_revoke.return_value = True

        disconnect_res = client.delete("/api/v1/integrations/gmail", headers={"Authorization": f"Bearer {user_token}"})
        assert disconnect_res.status_code == 200
        assert disconnect_res.json()["success"] is True

        # Verify DB records deleted
        deleted_int = db_session.query(EmailIntegration).filter(EmailIntegration.id == integration.id).first()
        assert deleted_int is None
        deleted_tok = db_session.query(OAuthToken).filter(OAuthToken.integration_id == integration.id).first()
        assert deleted_tok is None


def test_delete_gmail_integration_data(test_user, user_token, db_session):
    integration = EmailIntegration(
        user_id=test_user.id,
        provider="gmail",
        provider_account_id="user_data@gmail.com",
        email_address="user_data@gmail.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.flush()

    msg1 = MonitoredMessage(
        integration_id=integration.id,
        provider_message_id="msg_111",
        classification="safe",
        risk_score=10,
    )
    msg2 = MonitoredMessage(
        integration_id=integration.id,
        provider_message_id="msg_222",
        classification="phishing",
        risk_score=85,
    )
    db_session.add_all([msg1, msg2])
    db_session.commit()

    delete_res = client.delete("/api/v1/integrations/gmail/data", headers={"Authorization": f"Bearer {user_token}"})
    assert delete_res.status_code == 200
    assert "Purged 2 stored scan summaries" in delete_res.json()["message"]

    remaining_msgs = db_session.query(MonitoredMessage).filter(MonitoredMessage.integration_id == integration.id).all()
    assert len(remaining_msgs) == 0

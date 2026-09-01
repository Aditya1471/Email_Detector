import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import httpx
import jwt
import pytest

from app.config import settings
from app.services.gmail_service import gmail_oauth_service


def test_generate_authorization_url():
    test_user_id = uuid.uuid4()
    auth_url = gmail_oauth_service.generate_authorization_url(test_user_id)

    assert "accounts.google.com" in auth_url
    assert "gmail.readonly" in auth_url
    assert "access_type=offline" in auth_url
    assert "prompt=consent" in auth_url

    parsed_url = urllib.parse.urlparse(auth_url)
    query_params = urllib.parse.parse_qs(parsed_url.query)

    assert "state" in query_params
    state_token = query_params["state"][0]

    # Verify state payload
    resolved_id = gmail_oauth_service.verify_state(state_token)
    assert resolved_id == test_user_id


def test_verify_state_tampering():
    test_user_id = uuid.uuid4()
    auth_url = gmail_oauth_service.generate_authorization_url(test_user_id)
    parsed_url = urllib.parse.urlparse(auth_url)
    query_params = urllib.parse.parse_qs(parsed_url.query)
    valid_state = query_params["state"][0]

    tampered_state = valid_state[:-5] + "ABCDE"

    with pytest.raises(ValueError, match="OAuth state token is invalid"):
        gmail_oauth_service.verify_state(tampered_state)


def test_verify_state_expired():
    test_user_id = uuid.uuid4()
    past_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    expired_payload = {
        "sub": str(test_user_id),
        "type": "oauth_state",
        "provider": "gmail",
        "nonce": "test_nonce_123",
        "iat": int(past_time.timestamp()),
        "exp": int((past_time + timedelta(minutes=10)).timestamp()),
    }
    expired_state = jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(ValueError, match="OAuth state token is invalid or has expired"):
        gmail_oauth_service.verify_state(expired_state)


def test_verify_state_invalid_provider_or_type():
    test_user_id = uuid.uuid4()
    invalid_payload = {
        "sub": str(test_user_id),
        "type": "wrong_type",
        "provider": "outlook",
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()),
    }
    invalid_state = jwt.encode(invalid_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(ValueError, match="OAuth state token is invalid"):
        gmail_oauth_service.verify_state(invalid_state)


@pytest.mark.anyio
async def test_exchange_code_for_tokens_mocked():
    mock_token_response = {
        "access_token": "mock_access_token_abc123",
        "refresh_token": "mock_refresh_token_xyz987",
        "expires_in": 3599,
        "token_type": "Bearer",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(200, json=mock_token_response)

        tokens = await gmail_oauth_service.exchange_code_for_tokens("mock_auth_code_123")
        assert tokens["access_token"] == "mock_access_token_abc123"
        assert tokens["refresh_token"] == "mock_refresh_token_xyz987"


@pytest.mark.anyio
async def test_get_user_profile_mocked():
    mock_profile_response = {
        "emailAddress": "security.officer@gmail.com",
        "messagesTotal": 150,
        "threadsTotal": 80,
        "historyId": "12345678",
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = httpx.Response(200, json=mock_profile_response)

        profile = await gmail_oauth_service.get_user_profile("mock_valid_token")
        assert profile["email_address"] == "security.officer@gmail.com"
        assert profile["provider_account_id"] == "security.officer@gmail.com"


@pytest.mark.anyio
async def test_refresh_access_token_mocked():
    mock_refresh_response = {
        "access_token": "mock_refreshed_access_token_999",
        "expires_in": 3600,
        "token_type": "Bearer",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(200, json=mock_refresh_response)

        refreshed = await gmail_oauth_service.refresh_access_token("mock_refresh_token")
        assert refreshed["access_token"] == "mock_refreshed_access_token_999"


@pytest.mark.anyio
async def test_revoke_token_mocked():
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(200)

        revoked = await gmail_oauth_service.revoke_token("token_to_revoke")
        assert revoked is True

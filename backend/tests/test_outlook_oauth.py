import time
import uuid

import pytest

from app.services.outlook_service import outlook_service


def test_generate_outlook_authorization_url():
    test_user_id = uuid.uuid4()
    url = outlook_service.generate_authorization_url(test_user_id)
    assert "state=" in url
    assert "code=" in url or "response_type=code" in url


def test_verify_outlook_state_tampering():
    test_user_id = uuid.uuid4()
    state = outlook_service._create_state(test_user_id)
    parts = state.split(":")
    tampered_state = f"{parts[0]}:{parts[1]}:{parts[2]}:{parts[3]}:0000000000000000000000000000000000000000000000000000000000000000"
    assert outlook_service.verify_state(tampered_state) is None


def test_verify_outlook_state_expired():
    test_user_id = uuid.uuid4()
    old_ts = int(time.time()) - 1000
    nonce = "abcd1234efgh5678"
    payload = f"outlook:{test_user_id}:{old_ts}:{nonce}"
    import hashlib
    import hmac
    sig = hmac.new(outlook_service.state_secret, payload.encode(), hashlib.sha256).hexdigest()
    expired_state = f"{payload}:{sig}"
    assert outlook_service.verify_state(expired_state) is None


def test_verify_outlook_state_invalid_provider():
    test_user_id = uuid.uuid4()
    ts = int(time.time())
    nonce = "abcd1234efgh5678"
    payload = f"gmail:{test_user_id}:{ts}:{nonce}"
    import hashlib
    import hmac
    sig = hmac.new(outlook_service.state_secret, payload.encode(), hashlib.sha256).hexdigest()
    invalid_provider_state = f"{payload}:{sig}"
    assert outlook_service.verify_state(invalid_provider_state) is None


@pytest.mark.anyio
async def test_exchange_code_for_tokens_mocked():
    tokens = await outlook_service.exchange_code_for_tokens("mock_auth_code_999")
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["expires_in"] == 3600


@pytest.mark.anyio
async def test_get_user_profile_stable_id_mapping():
    profile = await outlook_service.get_user_profile("mock_access_token_123")
    # Requirement 1: Provider account ID must be stable Microsoft user ID, not email
    assert profile["provider_account_id"] == "ms-user-id-mock-12345678"
    assert "@" in profile["email_address"]


@pytest.mark.anyio
async def test_refresh_access_token_mocked():
    new_tokens = await outlook_service.refresh_access_token("mock_refresh_token_123")
    assert "access_token" in new_tokens
    assert "mock_ms_refreshed_access_" in new_tokens["access_token"]


@pytest.mark.anyio
async def test_create_and_renew_subscription_mocked():
    sub_res = await outlook_service.create_subscription("mock_token", "http://localhost:8000/webhook", "test-client-state")
    assert "id" in sub_res
    assert sub_res["changeType"] == "created"

    renew_res = await outlook_service.renew_subscription("mock_token", sub_res["id"])
    assert renew_res["id"] == sub_res["id"]
    assert "expirationDateTime" in renew_res

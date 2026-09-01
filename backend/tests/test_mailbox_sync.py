import base64
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.services.mailbox_sync_service import mailbox_sync_service
from app.services.token_encryption_service import token_encryption_service


@pytest.fixture
def sync_user(db_session):
    user = User(email="sync.tester@example.com", password_hash="hashedpassword123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sync_integration(sync_user, db_session):
    integration = EmailIntegration(
        user_id=sync_user.id,
        provider="gmail",
        provider_account_id="sync.tester@gmail.com",
        email_address="sync.tester@gmail.com",
        is_active=True,
    )
    db_session.add(integration)
    db_session.flush()

    oauth_token = OAuthToken(
        integration_id=integration.id,
        encrypted_access_token=token_encryption_service.encrypt("valid_access_token_123"),
        encrypted_refresh_token=token_encryption_service.encrypt("valid_refresh_token_456"),
    )
    db_session.add(oauth_token)
    db_session.commit()
    db_session.refresh(integration)
    return integration


def make_mock_gmail_message(msg_id: str, sender: str, subject: str, body_text: str):
    b64_body = base64.urlsafe_b64encode(body_text.encode("utf-8")).decode("ASCII")
    return {
        "id": msg_id,
        "payload": {
            "headers": [
                {"name": "From", "value": sender},
                {"name": "To", "value": "sync.tester@gmail.com"},
                {"name": "Subject", "value": subject},
                {"name": "Date", "value": "Tue, 1 Sep 2026 12:00:00 +0000"},
            ],
            "mimeType": "text/plain",
            "body": {"data": b64_body},
        },
    }


@pytest.mark.anyio
async def test_list_inbox_messages_mocked():
    mock_response = {"messages": [{"id": "msg_001"}, {"id": "msg_002"}]}
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = httpx.Response(200, json=mock_response)

        messages = await mailbox_sync_service.list_inbox_messages("test_token")
        assert len(messages) == 2
        assert messages[0]["id"] == "msg_001"


@pytest.mark.anyio
async def test_sync_user_gmail_success(sync_user, sync_integration, db_session):
    msg1 = make_mock_gmail_message(
        "msg_101",
        "alert-spoof@fictional-bank-security.com",
        "URGENT Account Limit hold suspension verification",
        "Please confirm details immediately at http://fictional-bank-security-portal.xyz/login to lift hold details.",
    )
    msg2 = make_mock_gmail_message(
        "msg_102",
        "colleague@organization-sandbox.com",
        "Project review sync slides discussion",
        "Hi team, please review the slides before our synchronization meeting tomorrow at 2PM. Thanks!",
    )

    with (
        patch.object(mailbox_sync_service, "list_inbox_messages", new_callable=AsyncMock) as mock_list,
        patch.object(mailbox_sync_service, "fetch_message_detail", new_callable=AsyncMock) as mock_fetch,
    ):
        mock_list.return_value = [{"id": "msg_101"}, {"id": "msg_102"}]
        mock_fetch.side_effect = lambda token, mid: msg1 if mid == "msg_101" else msg2

        result = await mailbox_sync_service.sync_user_gmail(db_session, sync_user, sync_integration)

        assert result["status"] == "completed"
        assert result["messages_found"] == 2
        assert result["messages_processed"] == 2
        assert result["messages_skipped"] == 0
        assert result["messages_failed"] == 0
        assert result["high_risk_count"] >= 1  # msg1 contains suspicious keywords and .xyz URL

        # Verify DB records
        records = db_session.query(MonitoredMessage).filter(MonitoredMessage.integration_id == sync_integration.id).all()
        assert len(records) == 2
        p_ids = {r.provider_message_id for r in records}
        assert "msg_101" in p_ids
        assert "msg_102" in p_ids

        # Ensure no full email body column exists or was persisted
        assert not hasattr(records[0], "body")


@pytest.mark.anyio
async def test_sync_user_gmail_idempotent_skipping(sync_user, sync_integration, db_session):
    # Pre-populate one message as already processed
    existing_msg = MonitoredMessage(
        integration_id=sync_integration.id,
        provider_message_id="msg_201",
        sender_domain="trusted.com",
        subject_preview="Welcome",
        classification="safe",
        risk_score=10,
    )
    db_session.add(existing_msg)
    db_session.commit()

    msg_new = make_mock_gmail_message("msg_202", "Updates <news@news.com>", "Daily News", "Here is today's summary.")

    with (
        patch.object(mailbox_sync_service, "list_inbox_messages", new_callable=AsyncMock) as mock_list,
        patch.object(mailbox_sync_service, "fetch_message_detail", new_callable=AsyncMock) as mock_fetch,
    ):
        mock_list.return_value = [{"id": "msg_201"}, {"id": "msg_202"}]
        mock_fetch.return_value = msg_new

        result = await mailbox_sync_service.sync_user_gmail(db_session, sync_user, sync_integration)

        assert result["messages_found"] == 2
        assert result["messages_processed"] == 1
        assert result["messages_skipped"] == 1  # msg_201 was skipped cleanly
        assert result["messages_failed"] == 0


@pytest.mark.anyio
async def test_sync_user_gmail_paused_rejection(sync_user, sync_integration, db_session):
    sync_integration.is_active = False
    db_session.commit()

    with pytest.raises(ValueError, match="Gmail monitoring is currently paused"):
        await mailbox_sync_service.sync_user_gmail(db_session, sync_user, sync_integration)


@pytest.mark.anyio
async def test_sync_user_gmail_empty_inbox(sync_user, sync_integration, db_session):
    with patch.object(mailbox_sync_service, "list_inbox_messages", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = []

        result = await mailbox_sync_service.sync_user_gmail(db_session, sync_user, sync_integration)
        assert result["status"] == "no_new_messages"
        assert result["messages_found"] == 0
        assert result["messages_processed"] == 0

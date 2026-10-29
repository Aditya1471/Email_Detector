import hashlib
import logging
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.schemas.integration import (
    IntegrationResponse,
    IntegrationStatusResponse,
    OAuthConnectResponse,
)
from app.schemas.job import JobEnqueueResponse
from app.security.rate_limiter import rate_limit
from app.services.outlook_service import outlook_service
from app.services.token_encryption_service import token_encryption_service
from app.tasks.outlook_tasks import execute_sync_outlook_job, sync_outlook_mailbox_job

logger = logging.getLogger("phishguard.api.outlook")

router = APIRouter(prefix="/integrations/outlook", tags=["integrations-outlook"])


@router.get(
    "/connect",
    response_model=OAuthConnectResponse,
    dependencies=[Depends(rate_limit("general"))],
)
def connect_outlook(current_user: User = Depends(get_current_active_user)):
    """
    Generates a secure Microsoft OAuth 2.0 authorization URL requesting minimal read-only permissions.
    """
    auth_url = outlook_service.generate_authorization_url(current_user.id)
    return OAuthConnectResponse(
        provider="outlook",
        authorization_url=auth_url,
        message="Redirect the user to this authorization URL to grant read-only Outlook permissions.",
    )


@router.get("/callback")
async def outlook_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Handles OAuth 2.0 authorization callback from Microsoft Identity Platform.
    Validates state signature, exchanges code for tokens, maps stable user ID,
    and initializes mailbox subscription.
    """
    if error:
        err_msg = error_description or error
        logger.warning(f"Microsoft OAuth returned an error: {err_msg}")
        redirect_url = f"{settings.FRONTEND_INTEGRATIONS_URL}?error={urllib.parse.quote(err_msg)}&provider=outlook"
        return RedirectResponse(url=redirect_url)

    if not code or not state:
        logger.warning("Microsoft OAuth callback missing code or state.")
        redirect_url = f"{settings.FRONTEND_INTEGRATIONS_URL}?error=missing_oauth_parameters&provider=outlook"
        return RedirectResponse(url=redirect_url)

    user_id = outlook_service.verify_state(state)
    if not user_id:
        logger.warning("Microsoft OAuth callback state verification failed (tampered or expired).")
        redirect_url = f"{settings.FRONTEND_INTEGRATIONS_URL}?error=invalid_or_expired_state&provider=outlook"
        return RedirectResponse(url=redirect_url)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error(f"User {user_id} not found during Microsoft OAuth callback.")
        redirect_url = f"{settings.FRONTEND_INTEGRATIONS_URL}?error=user_not_found&provider=outlook"
        return RedirectResponse(url=redirect_url)

    try:
        # Exchange authorization code for tokens
        tokens = await outlook_service.exchange_code_for_tokens(code)
        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        # Retrieve profile (stable Microsoft user ID + email)
        profile = await outlook_service.get_user_profile(access_token)
        provider_account_id = profile["provider_account_id"]
        email_address = profile["email_address"]

        # Encrypt tokens at rest
        encrypted_access = token_encryption_service.encrypt(access_token)
        encrypted_refresh = token_encryption_service.encrypt(refresh_token) if refresh_token else None

        # Upsert EmailIntegration
        integration = (
            db.query(EmailIntegration)
            .filter(EmailIntegration.user_id == user.id, EmailIntegration.provider == "outlook")
            .first()
        )

        if not integration:
            integration = EmailIntegration(
                user_id=user.id,
                provider="outlook",
                provider_account_id=provider_account_id,
                email_address=email_address,
                is_active=True,
            )
            db.add(integration)
            db.flush()
        else:
            integration.provider_account_id = provider_account_id
            integration.email_address = email_address
            integration.is_active = True

        # Upsert OAuthToken
        oauth_token = (
            db.query(OAuthToken)
            .filter(OAuthToken.integration_id == integration.id)
            .first()
        )
        if not oauth_token:
            oauth_token = OAuthToken(
                integration_id=integration.id,
                encrypted_access_token=encrypted_access,
                encrypted_refresh_token=encrypted_refresh,
                token_expiry=expires_at,
            )
            db.add(oauth_token)
        else:
            oauth_token.encrypted_access_token = encrypted_access
            if encrypted_refresh:
                oauth_token.encrypted_refresh_token = encrypted_refresh
            oauth_token.token_expiry = expires_at

        # Initialize Microsoft Graph change-notification subscription
        try:
            client_state = settings.MICROSOFT_WEBHOOK_CLIENT_STATE
            client_state_hash = hashlib.sha256(client_state.encode()).hexdigest()
            sub_res = await outlook_service.create_subscription(
                access_token=access_token,
                webhook_url=settings.MICROSOFT_WEBHOOK_URL,
                client_state=client_state,
            )
            if sub_res and "id" in sub_res:
                integration.subscription_id = sub_res["id"]
                integration.subscription_resource = sub_res.get("resource", "me/mailFolders('Inbox')/messages")
                exp_str = sub_res.get("expirationDateTime")
                if exp_str:
                    integration.subscription_expiry = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
                integration.client_state_hash = client_state_hash
                integration.last_renewed_at = datetime.now(timezone.utc)
        except Exception as sub_err:
            logger.warning(f"Subscription creation skipped during connect (manual sync remains active): {str(sub_err)}")

        db.commit()
        logger.info(f"Successfully connected Outlook integration for user {user.id} ({email_address})")

        redirect_url = f"{settings.FRONTEND_INTEGRATIONS_URL}?connected=outlook&email={urllib.parse.quote(email_address)}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        logger.error(f"Unexpected error during Microsoft OAuth callback: {str(e)}")
        redirect_url = f"{settings.FRONTEND_INTEGRATIONS_URL}?error=oauth_exchange_failed&provider=outlook"
        return RedirectResponse(url=redirect_url)


@router.post(
    "/sync",
    response_model=JobEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit("general"))],
)
async def sync_outlook_messages(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Asynchronously queues a background job to synchronize recent Outlook inbox messages.
    Returns HTTP 202 Accepted with a unique job ID.
    """
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "outlook")
        .first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected Outlook integration found for this user. Please connect your Outlook account first.",
        )

    if not integration.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Outlook monitoring is currently paused. Please resume monitoring before checking for new emails.",
        )

    # Check for active job idempotency
    active_job = (
        db.query(BackgroundJob)
        .filter(
            BackgroundJob.integration_id == integration.id,
            BackgroundJob.job_type == "outlook_sync",
            BackgroundJob.status.in_(["queued", "running"]),
        )
        .first()
    )
    if active_job:
        return JobEnqueueResponse(
            job_id=active_job.id,
            status=active_job.status,
            message="An Outlook email synchronization job is already in progress.",
        )

    job = BackgroundJob(
        job_type="outlook_sync",
        user_id=current_user.id,
        integration_id=integration.id,
        status="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if settings.QUEUE_ENABLED:
        sync_outlook_mailbox_job.delay(str(job.id), str(integration.id), str(current_user.id))
    else:
        execute_sync_outlook_job(str(job.id), str(integration.id), str(current_user.id), db_session=db)
        db.refresh(job)

    return JobEnqueueResponse(
        job_id=job.id,
        status=job.status,
        message="Email synchronization has been queued.",
    )


@router.post(
    "/pause",
    response_model=IntegrationStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
def pause_outlook_integration(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "outlook")
        .first()
    )
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlook integration not found.")

    integration.is_active = False
    db.commit()
    db.refresh(integration)
    return IntegrationStatusResponse(
        success=True,
        message="Outlook email monitoring has been paused.",
        integration=IntegrationResponse.model_validate(integration),
    )


@router.post(
    "/resume",
    response_model=IntegrationStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
def resume_outlook_integration(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "outlook")
        .first()
    )
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlook integration not found.")

    integration.is_active = True
    db.commit()
    db.refresh(integration)
    return IntegrationStatusResponse(
        success=True,
        message="Outlook email monitoring has been resumed.",
        integration=IntegrationResponse.model_validate(integration),
    )


@router.delete(
    "",
    response_model=IntegrationStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def disconnect_outlook_integration(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "outlook")
        .first()
    )
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlook integration not found.")

    # Remove subscription on Microsoft Graph if exists
    if integration.subscription_id:
        oauth_token = db.query(OAuthToken).filter(OAuthToken.integration_id == integration.id).first()
        if oauth_token and oauth_token.encrypted_access_token:
            try:
                access_token = token_encryption_service.decrypt(oauth_token.encrypted_access_token)
                await outlook_service.delete_subscription(access_token, integration.subscription_id)
            except Exception as e:
                logger.warning(f"Could not delete Microsoft Graph subscription {integration.subscription_id}: {str(e)}")

    db.delete(integration)
    db.commit()
    return IntegrationStatusResponse(
        success=True,
        message="Outlook integration and associated credentials have been disconnected.",
        integration=None,
    )


@router.post(
    "/renew",
    dependencies=[Depends(rate_limit("general"))],
)
async def renew_outlook_subscription(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Manually triggers subscription renewal for the connected Outlook account.
    """
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "outlook")
        .first()
    )
    if not integration or not integration.subscription_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active Outlook subscription found to renew.",
        )

    oauth_token = db.query(OAuthToken).filter(OAuthToken.integration_id == integration.id).first()
    if not oauth_token or not oauth_token.encrypted_access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OAuth credentials.")

    access_token = token_encryption_service.decrypt(oauth_token.encrypted_access_token)
    res = await outlook_service.renew_subscription(access_token, integration.subscription_id)

    exp_str = res.get("expirationDateTime")
    if exp_str:
        integration.subscription_expiry = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
        integration.last_renewed_at = datetime.now(timezone.utc)
        db.commit()

    return {"success": True, "subscription_id": integration.subscription_id, "expires_at": integration.subscription_expiry}


@router.api_route("/webhook", methods=["GET", "POST"])
async def outlook_change_notification_webhook(
    request: Request,
    validationToken: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Microsoft Graph Webhook validation and change-notification receiver.
    1. Validation Request: Responds with plain text validation token immediately.
    2. Change Notification: Validates clientState and enqueues asynchronous processing.
    """
    # 1. Validation challenge from Microsoft Graph
    if validationToken:
        logger.info("Received Microsoft Graph subscription validation challenge.")
        return PlainTextResponse(content=validationToken, status_code=200)

    # 2. Notification payload from Microsoft Graph
    try:
        body = await request.json()
    except Exception:
        return PlainTextResponse(content="Invalid JSON body", status_code=400)

    notifications = body.get("value", [])
    expected_client_state = settings.MICROSOFT_WEBHOOK_CLIENT_STATE

    for item in notifications:
        client_state = item.get("clientState")
        if client_state != expected_client_state:
            logger.warning("Rejected Microsoft Graph webhook: Invalid clientState.")
            continue

        subscription_id = item.get("subscriptionId")
        if not subscription_id:
            continue

        # Look up integration
        integration = (
            db.query(EmailIntegration)
            .filter(
                EmailIntegration.provider == "outlook",
                EmailIntegration.subscription_id == subscription_id,
                EmailIntegration.is_active == True,  # noqa: E712
            )
            .first()
        )
        if not integration:
            logger.warning(f"Webhook notification received for unknown/inactive subscription {subscription_id}.")
            continue

        integration.last_notification_at = datetime.now(timezone.utc)
        db.commit()

        # Enqueue background sync job for the integration
        job = BackgroundJob(
            job_type="outlook_sync",
            user_id=integration.user_id,
            integration_id=integration.id,
            status="queued",
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        if settings.QUEUE_ENABLED:
            sync_outlook_mailbox_job.delay(str(job.id), str(integration.id), str(integration.user_id))
        else:
            execute_sync_outlook_job(str(job.id), str(integration.id), str(integration.user_id), db_session=db)

    # Respond HTTP 202 Accepted quickly to Microsoft Graph
    return PlainTextResponse(content="Accepted", status_code=202)

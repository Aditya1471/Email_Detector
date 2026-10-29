import logging
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.monitored_message import MonitoredMessage
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.schemas.integration import (
    IntegrationListResponse,
    IntegrationResponse,
    IntegrationStatusResponse,
    MonitoredMessageListResponse,
    OAuthConnectResponse,
)
from app.schemas.job import JobEnqueueResponse
from app.security.rate_limiter import rate_limit
from app.services.gmail_service import gmail_oauth_service
from app.services.token_encryption_service import token_encryption_service
from app.tasks.gmail_tasks import execute_sync_gmail_job, sync_gmail_mailbox_job

logger = logging.getLogger("phishguard.api.integrations")

router = APIRouter(tags=["integrations"])


@router.get(
    "/integrations/gmail/connect",
    response_model=OAuthConnectResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def connect_gmail(
    current_user: User = Depends(get_current_active_user),
):
    """
    Generates a secure Google OAuth 2.0 authorization URL containing a signed anti-CSRF state token.
    Requests read-only Gmail access (gmail.readonly) to inspect incoming messages for phishing indicators.
    """
    try:
        auth_url = gmail_oauth_service.generate_authorization_url(current_user.id)
        return OAuthConnectResponse(provider="gmail", authorization_url=auth_url)
    except Exception as e:
        logger.error(f"Failed to generate Gmail OAuth URL for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate Google OAuth connection flow.",
        )


@router.get("/integrations/gmail/callback")
async def gmail_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None, description="Google OAuth authorization code"),
    state: Optional[str] = Query(None, description="Signed anti-CSRF state token"),
    error: Optional[str] = Query(None, description="Google OAuth error reason if denied"),
    db: Session = Depends(get_db),
):
    """
    Handles Google OAuth redirect callback, verifies state signature, exchanges code for tokens,
    encrypts tokens at rest, and registers or updates the user's Gmail integration.
    """
    # Check if user denied permission or provider returned an error
    if error:
        logger.warning(f"Google OAuth denied or returned error: {error}")
        redirect_target = f"{settings.FRONTEND_INTEGRATIONS_URL}?status=error&message={urllib.parse.quote('Google authorization was denied or cancelled.')}"
        return RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)

    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required OAuth code or state parameter.",
        )

    # 1. Verify anti-CSRF state token
    try:
        user_id = gmail_oauth_service.verify_state(state)
    except ValueError as e:
        logger.warning(f"Invalid OAuth state on callback: {str(e)}")
        redirect_target = f"{settings.FRONTEND_INTEGRATIONS_URL}?status=error&message={urllib.parse.quote(str(e))}"
        return RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)

    # 2. Confirm user exists and is active
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with this OAuth session no longer exists.",
        )

    # 3. Exchange code for access & refresh tokens
    try:
        token_data = await gmail_oauth_service.exchange_code_for_tokens(code)
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
    except ValueError as e:
        logger.error(f"Token exchange error on callback: {str(e)}")
        redirect_target = f"{settings.FRONTEND_INTEGRATIONS_URL}?status=error&message={urllib.parse.quote(str(e))}"
        return RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google OAuth endpoint did not return an access token.",
        )

    # 4. Fetch Gmail account profile
    try:
        profile = await gmail_oauth_service.get_user_profile(access_token)
        email_address = profile["email_address"]
        provider_account_id = profile["provider_account_id"]
    except ValueError as e:
        logger.error(f"Failed to fetch user profile on callback: {str(e)}")
        redirect_target = f"{settings.FRONTEND_INTEGRATIONS_URL}?status=error&message={urllib.parse.quote(str(e))}"
        return RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)

    # 5. Encrypt tokens at rest
    encrypted_access_token = token_encryption_service.encrypt(access_token)
    encrypted_refresh_token = token_encryption_service.encrypt(refresh_token) if refresh_token else None
    token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # 6. Upsert EmailIntegration and OAuthToken records
    try:
        integration = (
            db.query(EmailIntegration)
            .filter(EmailIntegration.user_id == user.id, EmailIntegration.provider == "gmail")
            .first()
        )

        if not integration:
            integration = EmailIntegration(
                user_id=user.id,
                provider="gmail",
                provider_account_id=provider_account_id,
                email_address=email_address,
                is_active=True,
            )
            db.add(integration)
            db.flush()

            oauth_token_record = OAuthToken(
                integration_id=integration.id,
                encrypted_access_token=encrypted_access_token,
                encrypted_refresh_token=encrypted_refresh_token,
                token_expiry=token_expiry,
            )
            db.add(oauth_token_record)
        else:
            integration.email_address = email_address
            integration.provider_account_id = provider_account_id
            integration.is_active = True

            if integration.oauth_token:
                integration.oauth_token.encrypted_access_token = encrypted_access_token
                if encrypted_refresh_token:
                    integration.oauth_token.encrypted_refresh_token = encrypted_refresh_token
                integration.oauth_token.token_expiry = token_expiry
            else:
                oauth_token_record = OAuthToken(
                    integration_id=integration.id,
                    encrypted_access_token=encrypted_access_token,
                    encrypted_refresh_token=encrypted_refresh_token,
                    token_expiry=token_expiry,
                )
                db.add(oauth_token_record)

        db.commit()
        db.refresh(integration)
        logger.info(f"Successfully connected Gmail account {email_address} for user {user.id}")

        # Check if caller accepts JSON or browser redirect
        accept_header = request.headers.get("accept", "")
        if "application/json" in accept_header and "text/html" not in accept_header:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "success": True,
                    "message": "Gmail integration connected successfully.",
                    "email_address": email_address,
                    "provider": "gmail",
                },
            )

        redirect_target = f"{settings.FRONTEND_INTEGRATIONS_URL}?status=connected&email={urllib.parse.quote(email_address)}"
        return RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)
    except Exception as e:
        db.rollback()
        logger.error(f"Database error saving Gmail integration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist integration records.",
        )


@router.get(
    "/integrations",
    response_model=IntegrationListResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def list_integrations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Returns all active and paused email provider integrations for the authenticated user.
    """
    integrations = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id)
        .order_by(EmailIntegration.created_at.asc())
        .all()
    )
    return IntegrationListResponse(integrations=integrations, count=len(integrations))


@router.post(
    "/integrations/gmail/pause",
    response_model=IntegrationStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def pause_gmail_monitoring(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Pauses automatic inspection of new incoming Gmail messages.
    """
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "gmail")
        .first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected Gmail integration found for this user.",
        )

    integration.is_active = False
    db.commit()
    db.refresh(integration)
    return IntegrationStatusResponse(
        success=True,
        message="Gmail email monitoring has been paused.",
        integration=IntegrationResponse.model_validate(integration),
    )


@router.post(
    "/integrations/gmail/resume",
    response_model=IntegrationStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def resume_gmail_monitoring(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Resumes automatic inspection of new incoming Gmail messages.
    """
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "gmail")
        .first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected Gmail integration found for this user.",
        )

    integration.is_active = True
    db.commit()
    db.refresh(integration)
    return IntegrationStatusResponse(
        success=True,
        message="Gmail email monitoring has been resumed.",
        integration=IntegrationResponse.model_validate(integration),
    )


@router.delete(
    "/integrations/gmail",
    response_model=IntegrationStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def disconnect_gmail(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Disconnects the user's Gmail account, revokes the OAuth token with Google,
    and purges stored tokens from the database.
    """
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "gmail")
        .first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected Gmail integration found to disconnect.",
        )

    # Attempt to revoke token with Google if token exists
    if integration.oauth_token and integration.oauth_token.encrypted_access_token:
        try:
            plain_token = token_encryption_service.decrypt(integration.oauth_token.encrypted_access_token)
            await gmail_oauth_service.revoke_token(plain_token)
        except Exception as e:
            logger.warning(f"Token revocation error during disconnect: {str(e)}")

    db.delete(integration)
    db.commit()
    logger.info(f"Gmail integration disconnected and purged for user {current_user.id}")

    return IntegrationStatusResponse(
        success=True,
        message="Gmail account disconnected and OAuth tokens purged.",
        integration=None,
    )


@router.delete(
    "/integrations/gmail/data",
    response_model=IntegrationStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def delete_gmail_integration_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Purges all stored scan summaries and monitored message metadata for the connected Gmail account.
    """
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "gmail")
        .first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected Gmail integration found for this user.",
        )

    deleted_count = (
        db.query(MonitoredMessage)
        .filter(MonitoredMessage.integration_id == integration.id)
        .delete(synchronize_session=False)
    )
    db.commit()

    return IntegrationStatusResponse(
        success=True,
        message=f"Purged {deleted_count} stored scan summaries and notification records.",
        integration=IntegrationResponse.model_validate(integration),
    )


@router.post(
    "/integrations/gmail/sync",
    response_model=JobEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit("general"))],
)
async def sync_gmail_messages(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Asynchronously queues a background job to inspect recent Gmail inbox messages.
    Returns HTTP 202 Accepted with a unique tracking job ID.
    """
    integration = (
        db.query(EmailIntegration)
        .filter(EmailIntegration.user_id == current_user.id, EmailIntegration.provider == "gmail")
        .first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected Gmail integration found for this user. Please connect your Gmail account first.",
        )

    if not integration.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail monitoring is currently paused. Please resume monitoring before checking for new emails.",
        )

    # Check if a sync job is already queued or running for this integration (Idempotent job suppression)
    active_job = (
        db.query(BackgroundJob)
        .filter(
            BackgroundJob.integration_id == integration.id,
            BackgroundJob.job_type == "gmail_sync",
            BackgroundJob.status.in_(["queued", "running"]),
        )
        .first()
    )
    if active_job:
        return JobEnqueueResponse(
            job_id=active_job.id,
            status=active_job.status,
            message="An email synchronization job is already in progress.",
        )

    # Create background job record
    job = BackgroundJob(
        job_type="gmail_sync",
        user_id=current_user.id,
        integration_id=integration.id,
        status="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Dispatch to Celery queue if enabled, or execute synchronously in development mode
    if settings.QUEUE_ENABLED:
        sync_gmail_mailbox_job.delay(str(job.id), str(integration.id), str(current_user.id))
    else:
        # Synchronous execution for development/testing without Redis
        execute_sync_gmail_job(str(job.id), str(integration.id), str(current_user.id), db_session=db)
        db.refresh(job)

    return JobEnqueueResponse(
        job_id=job.id,
        status=job.status,
        message="Email synchronization has been queued.",
    )


@router.get(
    "/integrations/messages",
    response_model=MonitoredMessageListResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def list_monitored_messages(
    limit: int = Query(20, ge=1, le=100, description="Maximum number of monitored messages to return"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Returns recent monitored email message summaries across all active integrations for the authenticated user.
    """
    messages = (
        db.query(MonitoredMessage)
        .join(EmailIntegration, MonitoredMessage.integration_id == EmailIntegration.id)
        .filter(EmailIntegration.user_id == current_user.id)
        .order_by(MonitoredMessage.processed_at.desc())
        .limit(limit)
        .all()
    )

    return MonitoredMessageListResponse(messages=messages, count=len(messages))


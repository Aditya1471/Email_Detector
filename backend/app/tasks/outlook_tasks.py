import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.services.outlook_service import outlook_service
from app.services.token_encryption_service import token_encryption_service
from app.worker import celery_app

logger = logging.getLogger("phishguard.tasks.outlook")


def run_async(coro):
    """
    Executes an asynchronous coroutine synchronously inside a worker context.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def execute_sync_outlook_job(
    job_id_str: str,
    integration_id_str: str,
    user_id_str: str,
    db_session: Optional[Session] = None,
    retry_func: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Core execution logic for Microsoft Outlook mailbox synchronization.
    """
    job_id = uuid.UUID(job_id_str)
    integration_id = uuid.UUID(integration_id_str)
    user_id = uuid.UUID(user_id_str)

    should_close_db = False
    if db_session is not None:
        db = db_session
    else:
        db = SessionLocal()
        should_close_db = True

    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if not job:
            logger.error(f"Outlook sync job {job_id} not found.")
            return {"status": "failed", "error": "Job record not found"}

        now = datetime.now(timezone.utc)
        job.status = "running"
        job.started_at = now
        job.attempt_count += 1
        db.commit()

        user = db.query(User).filter(User.id == user_id).first()
        integration = db.query(EmailIntegration).filter(EmailIntegration.id == integration_id).first()

        if not user or not integration:
            job.status = "failed"
            job.error_code = "USER_OR_INTEGRATION_NOT_FOUND"
            job.error_message = "User or connected Outlook integration was not found."
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return {"status": "failed", "error": job.error_message}

        if not integration.is_active:
            job.status = "cancelled"
            job.error_code = "INTEGRATION_PAUSED"
            job.error_message = "Outlook monitoring is paused for this integration."
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return {"status": "cancelled", "error": job.error_message}

        # Execute Outlook sync coroutine
        sync_result = run_async(outlook_service.sync_user_outlook(db, user, integration))

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        summary_payload = {
            "messages_found": sync_result.get("messages_found", 0),
            "messages_processed": sync_result.get("messages_processed", 0),
            "messages_skipped": sync_result.get("messages_skipped", 0),
            "messages_failed": sync_result.get("messages_failed", 0),
            "high_risk_count": sync_result.get("high_risk_count", 0),
            "last_sync_at": sync_result.get("last_sync_at"),
        }
        job.result_summary = json.dumps(summary_payload)
        db.commit()

        logger.info(f"Outlook sync job {job_id} completed successfully for user {user_id}")
        return summary_payload

    except Exception as e:
        logger.error(f"Error executing Outlook sync job {job_id}: {str(e)}")
        err_str = str(e).lower()
        is_transient = "timeout" in err_str or "connection" in err_str or "rate limit" in err_str or "503" in err_str

        if is_transient and retry_func is not None:
            job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
            if job:
                job.status = "retrying"
                job.error_code = "TRANSIENT_NETWORK_ERROR"
                job.error_message = "Temporary network error. Retrying..."
                db.commit()
            raise retry_func(exc=e)

        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_code = "SYNC_FAILED"
            job.error_message = "Failed to synchronize Outlook messages. Please try again."
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

        return {"status": "failed", "error": str(e)}
    finally:
        if should_close_db:
            db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def sync_outlook_mailbox_job(self, job_id_str: str, integration_id_str: str, user_id_str: str) -> Dict[str, Any]:
    """
    Celery background task for asynchronous Outlook mailbox synchronization.
    """
    return execute_sync_outlook_job(job_id_str, integration_id_str, user_id_str, retry_func=self.retry)


@celery_app.task
def renew_outlook_subscriptions_job() -> Dict[str, Any]:
    """
    Scheduled background task to renew Microsoft Graph subscriptions nearing expiry (< 24 hours remaining).
    """
    db = SessionLocal()
    try:
        threshold = datetime.now(timezone.utc) + timedelta(hours=24)
        integrations = (
            db.query(EmailIntegration)
            .filter(
                EmailIntegration.provider == "outlook",
                EmailIntegration.is_active == True,  # noqa: E712
                EmailIntegration.subscription_id != None,  # noqa: E711
                EmailIntegration.subscription_expiry < threshold,
            )
            .all()
        )

        renewed_count = 0
        for integration in integrations:
            oauth_token = db.query(OAuthToken).filter(OAuthToken.integration_id == integration.id).first()
            if not oauth_token or not oauth_token.encrypted_access_token:
                continue

            access_token = token_encryption_service.decrypt(oauth_token.encrypted_access_token)
            try:
                renew_res = run_async(outlook_service.renew_subscription(access_token, integration.subscription_id))
                new_expiry_str = renew_res.get("expirationDateTime")
                if new_expiry_str:
                    integration.subscription_expiry = datetime.fromisoformat(new_expiry_str.replace("Z", "+00:00"))
                    integration.last_renewed_at = datetime.now(timezone.utc)
                    renewed_count += 1
            except Exception as e:
                logger.error(f"Failed to renew subscription {integration.subscription_id}: {str(e)}")

        db.commit()
        return {"renewed_subscriptions_count": renewed_count}
    finally:
        db.close()

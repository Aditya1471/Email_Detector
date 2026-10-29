import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.background_job import BackgroundJob
from app.models.email_integration import EmailIntegration
from app.models.user import User
from app.services.mailbox_sync_service import mailbox_sync_service
from app.worker import celery_app

logger = logging.getLogger("phishguard.tasks.gmail")


def run_async(coro):
    """
    Executes an asynchronous coroutine synchronously inside a task execution context.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def execute_sync_gmail_job(
    job_id_str: str,
    integration_id_str: str,
    user_id_str: str,
    db_session: Optional[Session] = None,
    retry_func: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Core execution logic for Gmail manual mailbox synchronization.
    Supports both Celery worker execution and in-process synchronous development/testing execution.
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
            logger.error(f"Job {job_id} not found in database.")
            return {"status": "failed", "error": "Job record not found"}

        # Mark job as running
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
            job.error_message = "User or connected integration was not found."
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return {"status": "failed", "error": job.error_message}

        if not integration.is_active:
            job.status = "cancelled"
            job.error_code = "INTEGRATION_PAUSED"
            job.error_message = "Gmail monitoring is paused for this integration."
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return {"status": "cancelled", "error": job.error_message}

        # Execute synchronization coroutine
        sync_result = run_async(mailbox_sync_service.sync_user_gmail(db, user, integration))

        # Mark job as completed
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        # Store safe result summary (NO email content or headers)
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

        logger.info(f"Sync job {job_id} successfully completed for user {user_id}")
        return summary_payload

    except Exception as e:
        logger.error(f"Error executing sync job {job_id}: {str(e)}")
        # Check if error is retryable
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

        # Permanent failure
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_code = "SYNC_FAILED"
            job.error_message = "Failed to synchronize messages. Please try again."
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

        return {"status": "failed", "error": str(e)}
    finally:
        if should_close_db:
            db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def sync_gmail_mailbox_job(self, job_id_str: str, integration_id_str: str, user_id_str: str) -> Dict[str, Any]:
    """
    Celery task wrapper for Gmail mailbox synchronization.
    """
    return execute_sync_gmail_job(job_id_str, integration_id_str, user_id_str, retry_func=self.retry)

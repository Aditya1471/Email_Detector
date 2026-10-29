import asyncio
import logging
import uuid
from typing import Any, Callable, Dict, Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.monitored_message import MonitoredMessage
from app.models.user import User
from app.services.notification_service import notification_service
from app.worker import celery_app

logger = logging.getLogger("phishguard.tasks.notifications")


def run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def execute_send_high_risk_sms_job(
    user_id_str: str,
    monitored_message_id_str: str,
    db_session: Optional[Session] = None,
    retry_func: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Core execution logic for SMS alert delivery.
    """
    user_id = uuid.UUID(user_id_str)
    monitored_msg_id = uuid.UUID(monitored_message_id_str)

    should_close_db = False
    if db_session is not None:
        db = db_session
    else:
        db = SessionLocal()
        should_close_db = True

    try:
        user = db.query(User).filter(User.id == user_id).first()
        msg = db.query(MonitoredMessage).filter(MonitoredMessage.id == monitored_msg_id).first()

        if not user or not msg:
            logger.warning(f"Notification task skipped: User {user_id} or Message {monitored_msg_id} not found.")
            return {"status": "skipped", "reason": "Entity not found"}

        notification = run_async(notification_service.process_high_risk_alert_if_eligible(db, user, msg))
        if notification:
            return {"status": notification.status, "notification_id": str(notification.id)}
        return {"status": "suppressed", "reason": "Threshold not met or SMS disabled"}
    except Exception as e:
        logger.error(f"Error in SMS delivery task for message {monitored_msg_id}: {str(e)}")
        if retry_func is not None:
            raise retry_func(exc=e)
        return {"status": "failed", "error": str(e)}
    finally:
        if should_close_db:
            db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_high_risk_sms_job(self, user_id_str: str, monitored_message_id_str: str) -> Dict[str, Any]:
    """
    Celery background task for asynchronous, idempotent delivery of high-risk SMS security alerts.
    """
    return execute_send_high_risk_sms_job(user_id_str, monitored_message_id_str, retry_func=self.retry)

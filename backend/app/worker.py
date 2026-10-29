import logging

from celery import Celery

from app.config import settings

logger = logging.getLogger("phishguard.worker")

celery_app = Celery(
    "phishguard_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_concurrency=settings.WORKER_CONCURRENCY,
    worker_prefetch_multiplier=1,
)

# Auto-discover task modules
celery_app.autodiscover_tasks(["app.tasks.gmail_tasks", "app.tasks.notification_tasks", "app.tasks.outlook_tasks"])

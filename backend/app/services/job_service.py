import logging
from datetime import datetime, timedelta, timezone
from typing import Dict

from sqlalchemy.orm import Session

from app.models.background_job import BackgroundJob

logger = logging.getLogger("phishguard.services.job")


class JobService:
    @staticmethod
    def cleanup_stale_background_jobs(db: Session, retention_days: int = 30) -> Dict[str, int]:
        """
        Purges completed, failed, or cancelled background jobs older than the retention window.
        Preserves active/running jobs and maintains database performance.
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)

        # Fetch matching stale jobs to cleanly support both SQLite test engine and PostgreSQL production
        stale_jobs = (
            db.query(BackgroundJob)
            .filter(
                BackgroundJob.status.in_(["completed", "failed", "cancelled"]),
                BackgroundJob.created_at < cutoff_date,
            )
            .all()
        )

        deleted_count = len(stale_jobs)
        for job in stale_jobs:
            db.delete(job)

        if deleted_count > 0:
            db.commit()

        logger.info(f"Purged {deleted_count} stale background job records older than {retention_days} days.")
        return {"deleted_jobs_count": deleted_count, "retention_days": retention_days}


job_service = JobService()

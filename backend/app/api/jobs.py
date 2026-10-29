import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.background_job import BackgroundJob
from app.models.user import User
from app.schemas.job import JobStatusResponse
from app.security.rate_limiter import rate_limit

logger = logging.getLogger("phishguard.api.jobs")

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get(
    "/{job_id}",
    response_model=JobStatusResponse,
    dependencies=[Depends(rate_limit("general"))],
)
def get_job_status(
    job_id: uuid.UUID = Path(..., description="Unique UUID identifier of the background job"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves the status, execution timestamps, and result statistics of a background task.
    Strictly enforces user ownership (users can only view their own jobs).
    """
    job = (
        db.query(BackgroundJob)
        .filter(BackgroundJob.id == job_id, BackgroundJob.user_id == current_user.id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background job not found or you do not have permission to access it.",
        )

    return JobStatusResponse.model_validate(job)

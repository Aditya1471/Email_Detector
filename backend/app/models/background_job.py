import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .email_integration import EmailIntegration
    from .user import User

from sqlalchemy import UUID, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # gmail_sync, message_analysis, sms_delivery
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    integration_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_integrations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued", index=True)  # queued, running, completed, failed, retrying, cancelled
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    error_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON-encoded statistics summary
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User")
    integration: Mapped[Optional["EmailIntegration"]] = relationship("EmailIntegration")

    def __repr__(self) -> str:
        return f"<BackgroundJob id={self.id} type={self.job_type} status={self.status} attempts={self.attempt_count}>"

import uuid
from datetime import datetime

from sqlalchemy import UUID, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Foreign Key to scans.id (CASCADE on delete)
    scan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False)
    # Foreign Key to users.id (CASCADE on delete)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    actual_label: Mapped[str] = mapped_column(String(50), nullable=False)
    is_helpful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    comment: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())

    # Relationships
    scan: Mapped["Scan"] = relationship("Scan", back_populates="feedbacks")
    user: Mapped["User"] = relationship("User", back_populates="feedbacks")

    __table_args__ = (
        CheckConstraint("actual_label IN ('safe', 'suspicious', 'phishing')", name="ck_feedbacks_actual_label"),
        UniqueConstraint("user_id", "scan_id", name="uq_feedbacks_user_scan"),
    )

    def __repr__(self) -> str:
        return f"<Feedback id={self.id} actual_label={self.actual_label} is_helpful={self.is_helpful}>"

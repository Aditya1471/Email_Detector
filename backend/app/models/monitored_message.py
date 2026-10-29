import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .email_integration import EmailIntegration
    from .notification import Notification

from sqlalchemy import UUID, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class MonitoredMessage(Base):
    __tablename__ = "monitored_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_integrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subject_preview: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    classification: Mapped[str] = mapped_column(String(50), nullable=False, default="safe")
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v1.0.0")
    url_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    indicator_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notification_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)

    # Relationships
    integration: Mapped["EmailIntegration"] = relationship("EmailIntegration", back_populates="monitored_messages")
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="monitored_message",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("integration_id", "provider_message_id", name="uq_integration_provider_message"),
    )

    def __repr__(self) -> str:
        return f"<MonitoredMessage id={self.id} msg_id={self.provider_message_id} risk={self.risk_score} class={self.classification}>"

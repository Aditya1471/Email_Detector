import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .monitored_message import MonitoredMessage
    from .user import User

from sqlalchemy import UUID, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    monitored_message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("monitored_messages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(50), nullable=False, default="sms")  # sms, browser, email
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")  # pending, sent, failed, suppressed
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Twilio SID, etc.
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)

    # Relationships
    user: Mapped["User"] = relationship("User")
    monitored_message: Mapped[Optional["MonitoredMessage"]] = relationship("MonitoredMessage", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} channel={self.channel} status={self.status}>"

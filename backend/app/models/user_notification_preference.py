import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .user import User

from sqlalchemy import UUID, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class UserNotificationPreference(Base):
    __tablename__ = "user_notification_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    encrypted_phone_number: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    masked_phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sms_alerts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    risk_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    browser_alerts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alerts_paused: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_recorded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_ip: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    opt_out_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notification_preference")

    def __repr__(self) -> str:
        return f"<UserNotificationPreference user_id={self.user_id} verified={self.is_phone_verified} sms={self.sms_alerts_enabled}>"

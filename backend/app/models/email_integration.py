import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .monitored_message import MonitoredMessage
    from .oauth_token import OAuthToken
    from .user import User

from sqlalchemy import UUID, Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class EmailIntegration(Base):
    __tablename__ = "email_integrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="gmail")
    provider_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_sync_cursor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    subscription_resource: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subscription_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    client_state_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_renewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_notification_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="integrations")
    oauth_token: Mapped[Optional["OAuthToken"]] = relationship(
        "OAuthToken",
        back_populates="integration",
        uselist=False,
        cascade="all, delete-orphan",
    )
    monitored_messages: Mapped[List["MonitoredMessage"]] = relationship(
        "MonitoredMessage",
        back_populates="integration",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_provider_integration"),
    )

    def __repr__(self) -> str:
        return f"<EmailIntegration id={self.id} user_id={self.user_id} provider={self.provider} email={self.email_address} is_active={self.is_active}>"

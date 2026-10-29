import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .email_integration import EmailIntegration

from sqlalchemy import UUID, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class OAuthToken(Base):
    __tablename__ = "oauth_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_integrations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    encrypted_access_token: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    integration: Mapped["EmailIntegration"] = relationship("EmailIntegration", back_populates="oauth_token")

    def is_expired(self) -> bool:
        if not self.token_expiry:
            return False
        expiry = self.token_expiry
        if expiry.tzinfo is None:
            from datetime import timezone
            expiry = expiry.replace(tzinfo=timezone.utc)
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) >= expiry

    def __repr__(self) -> str:
        return f"<OAuthToken id={self.id} integration_id={self.integration_id} expiry={self.token_expiry}>"

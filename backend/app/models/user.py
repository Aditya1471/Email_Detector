import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .email_integration import EmailIntegration
    from .feedback import Feedback
    from .scan import Scan
    from .user_notification_preference import UserNotificationPreference

from sqlalchemy import UUID, Boolean, CheckConstraint, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class User(Base):
    __tablename__ = "users"

    # UUID primary key generated at application layer via uuid.uuid4
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # Relationships
    # Note: On user deletion, associated scans remain but have user_id set to NULL
    scans: Mapped[List["Scan"]] = relationship("Scan", back_populates="user")
    # Note: On user deletion, associated feedback is deleted (CASCADE)
    feedbacks: Mapped[List["Feedback"]] = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")
    # Email integrations (CASCADE on user deletion)
    integrations: Mapped[List["EmailIntegration"]] = relationship("EmailIntegration", back_populates="user", cascade="all, delete-orphan")
    # Notification preferences (CASCADE on user deletion)
    notification_preference: Mapped[Optional["UserNotificationPreference"]] = relationship(
        "UserNotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"

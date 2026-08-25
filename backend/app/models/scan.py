import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, UUID, CheckConstraint, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class Scan(Base):
    __tablename__ = "scans"

    # UUID primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # Nullable foreign key to users.id with SET NULL cascade deletion
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )
    classification: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    risk_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    legitimate_probability: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    phishing_probability: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    model_version: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    processing_time_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    url_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    indicator_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    high_severity_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    sender_domain: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    recipient_domain: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    subject_preview: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    indicators_json: Mapped[dict] = mapped_column(
        JSON,
        nullable=False
    )
    urls_json: Mapped[dict] = mapped_column(
        JSON,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=func.now()
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="scans"
    )
    # Note: On scan deletion, feedbacks are deleted (CASCADE)
    feedbacks: Mapped[List["Feedback"]] = relationship(
        "Feedback",
        back_populates="scan",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "classification IN ('safe', 'suspicious', 'phishing')",
            name="ck_scans_classification"
        ),
        CheckConstraint(
            "risk_score >= 0 AND risk_score <= 100",
            name="ck_scans_risk_score"
        ),
        CheckConstraint(
            "confidence >= 0.0 AND confidence <= 1.0",
            name="ck_scans_confidence"
        ),
        CheckConstraint(
            "legitimate_probability >= 0.0 AND legitimate_probability <= 1.0",
            name="ck_scans_legitimate_probability"
        ),
        CheckConstraint(
            "phishing_probability >= 0.0 AND phishing_probability <= 1.0",
            name="ck_scans_phishing_probability"
        ),
        CheckConstraint(
            "processing_time_ms >= 0",
            name="ck_scans_processing_time"
        ),
        CheckConstraint(
            "url_count >= 0",
            name="ck_scans_url_count"
        ),
        CheckConstraint(
            "indicator_count >= 0",
            name="ck_scans_indicator_count"
        ),
        CheckConstraint(
            "high_severity_count >= 0 AND high_severity_count <= indicator_count",
            name="ck_scans_high_severity_count"
        ),
    )

    def __repr__(self) -> str:
        return f"<Scan id={self.id} classification={self.classification} risk_score={self.risk_score}>"

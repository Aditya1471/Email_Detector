from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    algorithm: Mapped[str] = mapped_column(String(255), nullable=False)
    metrics_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    dataset_description: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (UniqueConstraint("version", name="uq_model_versions_version"),)

    def __repr__(self) -> str:
        return f"<ModelVersion version={self.version} is_active={self.is_active}>"

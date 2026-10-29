import json
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class JobEnqueueResponse(BaseModel):
    job_id: uuid.UUID
    status: str = "queued"
    message: str = "Email synchronization has been queued."


class JobStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: Optional[uuid.UUID] = None
    job_type: str
    status: str
    attempt_count: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    result_summary: Optional[Dict[str, Any]] = None

    def model_post_init(self, __context: Any) -> None:
        if self.job_id is None:
            self.job_id = self.id

    @field_validator("result_summary", mode="before")
    @classmethod
    def parse_result_summary(cls, v: Any) -> Optional[Dict[str, Any]]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

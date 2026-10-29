import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class OAuthConnectResponse(BaseModel):
    provider: str = Field(..., example="gmail")
    authorization_url: str = Field(..., description="Google OAuth 2.0 consent URL with signed anti-CSRF state token")


class IntegrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    email_address: str
    is_active: bool
    last_sync_cursor: Optional[str] = None
    subscription_expiry: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class IntegrationListResponse(BaseModel):
    integrations: List[IntegrationResponse]
    count: int


class IntegrationStatusResponse(BaseModel):
    success: bool
    message: str
    integration: Optional[IntegrationResponse] = None


class MonitoredMessageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider_message_id: str
    sender_domain: Optional[str] = None
    subject_preview: Optional[str] = None
    classification: str
    risk_score: int
    url_count: int
    indicator_count: int
    processed_at: datetime


class SyncResultResponse(BaseModel):
    integration_id: uuid.UUID
    status: str = Field(..., description="Status of sync: 'completed', 'no_new_messages', 'partial_failure', 'failed'")
    messages_found: int
    messages_processed: int
    messages_skipped: int
    messages_failed: int
    high_risk_count: int
    last_sync_at: datetime
    recent_messages: List[MonitoredMessageSummary] = []


class MonitoredMessageListResponse(BaseModel):
    messages: List[MonitoredMessageSummary]
    count: int

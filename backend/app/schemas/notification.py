import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class StartPhoneVerificationRequest(BaseModel):
    phone_number: str = Field(..., description="E.164 formatted international phone number, e.g. +12025550123")


class StartPhoneVerificationResponse(BaseModel):
    status: str
    phone_number_masked: str
    mock_mode: bool = False
    message: str


class CheckPhoneVerificationRequest(BaseModel):
    phone_number: str = Field(..., description="E.164 formatted international phone number")
    code: str = Field(..., min_length=4, max_length=10, description="Verification one-time passcode")


class CheckPhoneVerificationResponse(BaseModel):
    success: bool
    message: str
    is_phone_verified: bool


class NotificationPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    phone_number_masked: Optional[str] = None
    is_phone_verified: bool
    sms_alerts_enabled: bool
    risk_threshold: int
    browser_alerts_enabled: bool
    alerts_paused: bool
    consent_recorded_at: Optional[datetime] = None
    opt_out_at: Optional[datetime] = None


class NotificationPreferenceUpdateRequest(BaseModel):
    sms_alerts_enabled: Optional[bool] = None
    risk_threshold: Optional[int] = Field(None, ge=50, le=100, description="Minimum risk score (50-100) to trigger alert")
    browser_alerts_enabled: Optional[bool] = None
    alerts_paused: Optional[bool] = None
    consent_accepted: Optional[bool] = Field(None, description="Explicit opt-in consent to receive security SMS alerts")


class NotificationRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    monitored_message_id: Optional[uuid.UUID] = None
    channel: str
    status: str
    provider_message_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: List[NotificationRecordResponse]
    count: int


class TestAlertResponse(BaseModel):
    success: bool
    message: str
    channel: str

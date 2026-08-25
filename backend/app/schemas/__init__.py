from pydantic import BaseModel, Field
from typing import List, Optional

# Re-expose existing scan schemas to preserve scans endpoints compatibility
class ScanRequest(BaseModel):
    sender: Optional[str] = ""
    recipient: Optional[str] = ""
    subject: Optional[str] = ""
    body: str = Field(..., min_length=5, description="The textual body content of the email to analyze.")

class Indicator(BaseModel):
    code: str
    severity: str
    title: str
    message: str

class ScanResponse(BaseModel):
    scan_id: str
    classification: str
    risk_score: int
    confidence: float
    model_version: str
    processing_time_ms: int
    indicators: List[Indicator]
    recommendation: str
    disclaimer: str
    sender: str
    recipient: str
    subject: str
    timestamp: str

class FeedbackRequest(BaseModel):
    rating: str = Field(..., description="Either 'yes' (accurate) or 'no' (incorrect).")
    comment: Optional[str] = ""

class FeedbackResponse(BaseModel):
    success: bool
    message: str

# Import new auth/user schemas
from .user import UserResponse
from .auth import RegisterRequest, LoginResponse, LoginUserDetail

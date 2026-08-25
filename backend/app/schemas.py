from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

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

class AuthRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class AuthResponse(BaseModel):
    success: bool
    email: str
    message: str

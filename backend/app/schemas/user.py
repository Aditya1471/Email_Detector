import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    """
    Standard schema for returning non-sensitive user profile data.
    """

    id: uuid.UUID
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

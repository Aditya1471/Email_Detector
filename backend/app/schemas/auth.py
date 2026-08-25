import uuid
from pydantic import BaseModel, EmailStr, Field, model_validator
from .user import UserResponse

class RegisterRequest(BaseModel):
    """
    Validates input parameters for account registration requests.
    Enforces password rules and email normalization.
    """
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters password limit.")
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        if not self.password.strip():
            raise ValueError("Password cannot be empty or whitespace only.")
        return self

class LoginUserDetail(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    is_active: bool

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    """
    Formats OAuth2 bearer login response payloads.
    """
    access_token: str
    token_type: str = "bearer"
    user: LoginUserDetail

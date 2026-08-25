from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginResponse
from app.schemas.user import UserResponse
from app.security.password import hash_password, verify_password
from app.security.jwt import create_access_token
from app.dependencies import get_current_active_user
from app.security.rate_limiter import rate_limit

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit("register"))])
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user account with normalized email and password hashing.
    """
    email_clean = payload.email.strip().lower()
    
    # Check duplicate email
    existing_user = db.query(User).filter(User.email == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )

    try:
        # Create user record
        new_user = User(
            email=email_clean,
            password_hash=hash_password(payload.password),
            role="user",
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        db.rollback()
        # Fallback security detail: log generally, do not leak raw engine trace details
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User registration failed."
        )

@router.post("/login", response_model=LoginResponse, dependencies=[Depends(rate_limit("login"))])
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Verifies user login credentials and issues a JWT token.
    Accepts form data matching username and password keys (OAuth2 specifications).
    """
    email_clean = form_data.username.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not user:
        raise credentials_exception

    if not verify_password(form_data.password, user.password_hash):
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=str(user.id), role=user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse, dependencies=[Depends(rate_limit("general"))])
def read_current_user(current_user: User = Depends(get_current_active_user)):
    """
    Returns the authenticated active user profile details.
    """
    return current_user

import uuid
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.jwt import decode_access_token

# Define standard OAuth2 security schema pointing to login URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)) -> Optional[User]:
    """
    FastAPI dependency resolving optional bearer token into active user context.
    Returns None if token is missing, invalid, or expired instead of throwing HTTP 401.
    """
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_id = uuid.UUID(user_id_str)
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.is_active:
            return user
    except Exception:
        pass
    return None


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    FastAPI dependency resolving bearer token into active database user instance.
    Raises standardized HTTP 401 on token parsing/validation anomalies.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise credentials_exception

        user_id = uuid.UUID(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Restricts routes to verified active accounts.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """
    Restricts access to administrative roles.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Admin privilege required.")
    return current_user

import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings

def create_access_token(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    """
    Generates a signed JWT access token.
    Claims:
      - sub: user identifier (converted to string)
      - role: user role check authorization
      - iat: issued time (timezone-aware UTC)
      - exp: expiration limit (timezone-aware UTC)
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    payload = {
        "sub": str(subject),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    
    encoded_jwt = jwt.encode(payload, settings.jwt_secret, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodes and validates a JWT access token.
    Throws jwt.PyJWTError on invalid, expired, or malformed tokens.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.JWT_ALGORITHM]
        )
        # Ensure subject exists
        if "sub" not in payload:
            raise jwt.PyJWTError("Token lacks sub claim.")
        return payload
    except jwt.ExpiredSignatureError:
        raise jwt.PyJWTError("Token has expired.")
    except jwt.InvalidTokenError:
        raise jwt.PyJWTError("Token signature or formatting is invalid.")

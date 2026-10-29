import logging
import secrets
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import httpx
import jwt

from app.config import settings

logger = logging.getLogger("phishguard.integrations.gmail")

# Read-only Gmail scope (Minimum permission required for security inspection)
GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"
GMAIL_PROFILE_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/profile"


class GmailOAuthService:
    """
    Handles Google OAuth 2.0 authorization, state signing, token exchange,
    token refresh, and revocation for Gmail read-only security inspection.
    """

    def generate_authorization_url(self, user_id: uuid.UUID) -> str:
        """
        Generates Google OAuth consent URL containing a cryptographically signed anti-CSRF state token.
        """
        now = datetime.now(timezone.utc)
        state_payload = {
            "sub": str(user_id),
            "type": "oauth_state",
            "provider": "gmail",
            "nonce": secrets.token_hex(16),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=15)).timestamp()),
        }
        signed_state = jwt.encode(state_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": GMAIL_READONLY_SCOPE,
            "access_type": "offline",  # Requests refresh_token for background synchronization
            "prompt": "consent",  # Forces consent to guarantee refresh_token issuance
            "state": signed_state,
        }
        encoded_params = urllib.parse.urlencode(params)
        return f"{GOOGLE_AUTH_ENDPOINT}?{encoded_params}"

    def verify_state(self, state: str) -> uuid.UUID:
        """
        Validates anti-CSRF state parameter and returns the authenticated user ID.
        Raises ValueError if state is tampered with, expired, or invalid.
        """
        if not state:
            raise ValueError("Missing OAuth state parameter.")

        try:
            payload = jwt.decode(
                state,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={"require": ["sub", "type", "provider", "exp"]},
            )
            if payload.get("type") != "oauth_state" or payload.get("provider") != "gmail":
                raise ValueError("Invalid OAuth state payload type or provider mismatch.")

            user_id = uuid.UUID(payload["sub"])
            return user_id
        except (jwt.PyJWTError, ValueError) as e:
            logger.warning(f"OAuth state validation failure: {str(e)}")
            raise ValueError("OAuth state token is invalid or has expired. Please initiate connection again.")

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchanges authorization code for access and refresh tokens with Google's token endpoint.
        """
        if not code:
            raise ValueError("Missing authorization code.")

        payload = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(GOOGLE_TOKEN_ENDPOINT, data=payload)
                if response.status_code != 200:
                    error_detail = response.text
                    logger.error(f"Google token exchange failed with status {response.status_code}: {error_detail}")
                    raise ValueError("Failed to exchange authorization code with Google OAuth provider.")

                token_data = response.json()
                return token_data
            except httpx.RequestError as e:
                logger.error(f"Network error communicating with Google OAuth endpoint: {str(e)}")
                raise ValueError("Network error communicating with Google OAuth provider. Please try again.")

    async def get_user_profile(self, access_token: str) -> Dict[str, str]:
        """
        Fetches the user's Gmail address and account profile using the access token.
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(GMAIL_PROFILE_ENDPOINT, headers=headers)
                if response.status_code == 200:
                    profile_data = response.json()
                    email_address = profile_data.get("emailAddress", "")
                    return {
                        "email_address": email_address.lower().strip(),
                        "provider_account_id": email_address.lower().strip(),
                    }

                # Fallback to userinfo endpoint if profile endpoint requires different permission
                userinfo_response = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers=headers)
                if userinfo_response.status_code == 200:
                    userinfo = userinfo_response.json()
                    return {
                        "email_address": userinfo.get("email", "").lower().strip(),
                        "provider_account_id": userinfo.get("id", ""),
                    }

                logger.error(f"Failed to fetch Gmail profile with status {response.status_code}: {response.text}")
                raise ValueError("Failed to retrieve profile information for the connected Gmail account.")
            except httpx.RequestError as e:
                logger.error(f"Network error fetching Gmail profile: {str(e)}")
                raise ValueError("Network error retrieving Gmail account profile.")

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Requests a fresh access token using the stored refresh token.
        """
        if not refresh_token:
            raise ValueError("Missing refresh token.")

        payload = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(GOOGLE_TOKEN_ENDPOINT, data=payload)
                if response.status_code != 200:
                    logger.error(f"Token refresh failed: {response.text}")
                    raise ValueError("Failed to refresh Gmail access token. Permission may have been revoked.")
                return response.json()
            except httpx.RequestError as e:
                logger.error(f"Network error refreshing access token: {str(e)}")
                raise ValueError("Network error refreshing access token.")

    async def revoke_token(self, token: str) -> bool:
        """
        Revokes an OAuth access or refresh token with Google's revocation endpoint.
        """
        if not token:
            return True

        params = {"token": token}
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(GOOGLE_REVOKE_ENDPOINT, params=params)
                return response.status_code == 200
            except Exception as e:
                logger.warning(f"Google token revocation request failed: {str(e)}")
                return False


# Global Gmail OAuth service singleton
gmail_oauth_service = GmailOAuthService()

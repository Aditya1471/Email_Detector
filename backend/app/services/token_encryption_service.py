import base64
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger("phishguard.security")


class TokenEncryptionService:
    """
    Symmetric token encryption service using Fernet (AES-128-CBC + HMAC-SHA256).
    Protects OAuth provider access and refresh tokens at rest in the database.
    """

    def __init__(self, key: Optional[str] = None):
        self._key = key or settings.TOKEN_ENCRYPTION_KEY
        self._fernet: Optional[Fernet] = None
        self._initialize_cipher()

    def _initialize_cipher(self):
        try:
            # Ensure key is valid Fernet 32-byte urlsafe base64 string
            if isinstance(self._key, str):
                key_bytes = self._key.encode("utf-8")
            else:
                key_bytes = self._key

            # Validate key length (Fernet expects 32-byte base64url encoded key = 44 bytes)
            if len(key_bytes) != 44:
                # If key is raw 32 bytes, encode to base64
                if len(key_bytes) == 32:
                    key_bytes = base64.urlsafe_b64encode(key_bytes)
                else:
                    raise ValueError(f"Invalid encryption key length: {len(key_bytes)}. Expected 44-character base64 string.")

            self._fernet = Fernet(key_bytes)
        except Exception as e:
            logger.error(f"Failed to initialize TokenEncryptionService: {str(e)}")
            raise ValueError(f"Token encryption configuration error: {str(e)}")

    def encrypt(self, plain_text: str) -> str:
        """
        Encrypts a plaintext token string into safe ciphertext.
        """
        if not plain_text:
            raise ValueError("Cannot encrypt empty token string.")
        if not self._fernet:
            self._initialize_cipher()

        cipher_bytes = self._fernet.encrypt(plain_text.encode("utf-8"))
        return cipher_bytes.decode("utf-8")

    def decrypt(self, cipher_text: str) -> str:
        """
        Decrypts an encrypted token ciphertext back to plaintext.
        """
        if not cipher_text:
            raise ValueError("Cannot decrypt empty ciphertext string.")
        if not self._fernet:
            self._initialize_cipher()

        try:
            plain_bytes = self._fernet.decrypt(cipher_text.encode("utf-8"))
            return plain_bytes.decode("utf-8")
        except InvalidToken:
            logger.error("Token decryption failed: Invalid token or tampered ciphertext.")
            raise ValueError("Decryption failed: Token is invalid, corrupted, or tampered with.")


# Global token encryption service singleton
token_encryption_service = TokenEncryptionService()

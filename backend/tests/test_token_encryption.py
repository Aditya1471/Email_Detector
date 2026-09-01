import pytest
from cryptography.fernet import Fernet

from app.services.token_encryption_service import TokenEncryptionService, token_encryption_service


def test_token_encryption_and_decryption():
    raw_token = "ya29.a0AfH6SMD_sample_oauth_access_token_123456789"
    cipher_text = token_encryption_service.encrypt(raw_token)

    assert cipher_text != raw_token
    assert len(cipher_text) > 30

    decrypted = token_encryption_service.decrypt(cipher_text)
    assert decrypted == raw_token


def test_token_encryption_with_refresh_token():
    refresh_token = "1//04_mock_refresh_token_very_long_string_abc"
    cipher_text = token_encryption_service.encrypt(refresh_token)

    assert token_encryption_service.decrypt(cipher_text) == refresh_token


def test_token_encryption_empty_input_rejection():
    with pytest.raises(ValueError, match="Cannot encrypt empty token"):
        token_encryption_service.encrypt("")

    with pytest.raises(ValueError, match="Cannot decrypt empty ciphertext"):
        token_encryption_service.decrypt("")


def test_token_decryption_tampered_ciphertext():
    tampered_cipher = "gAAAAABl_tampered_corrupted_cipher_string_123456789"
    with pytest.raises(ValueError, match="Decryption failed"):
        token_encryption_service.decrypt(tampered_cipher)


def test_custom_key_initialization():
    custom_key = Fernet.generate_key().decode()
    custom_service = TokenEncryptionService(key=custom_key)

    plain = "secret_provider_token_xyz"
    cipher = custom_service.encrypt(plain)
    assert custom_service.decrypt(cipher) == plain


def test_invalid_key_length_rejection():
    with pytest.raises(ValueError, match="Token encryption configuration error"):
        TokenEncryptionService(key="too_short_key")

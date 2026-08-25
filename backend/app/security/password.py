from pwdlib import PasswordHash

# Initialize password hashing engine using default recommend configs (Argon2 id)
# Argon2 is a slow, memory-hard key derivation function recommended by OWASP
password_hash_helper = PasswordHash.recommended()

def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using the Argon2 hashing algorithm.
    Argon2 generates an internal salt automatically for each hash.
    Note: Passwords are one-way hashed, not encrypted.
    """
    if not password or not password.strip():
        raise ValueError("Password must not be empty or whitespace only.")
    return password_hash_helper.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    """
    Safely verifies a candidate plaintext password against an Argon2 hash.
    Catches formatting exceptions on malformed hashes without raising internals.
    """
    if not password or not password_hash:
        return False
    try:
        return password_hash_helper.verify(password, password_hash)
    except Exception:
        return False

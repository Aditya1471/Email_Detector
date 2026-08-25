# PhishGuard Application Security Architecture

This document describes the security controls, validation mechanisms, and credentials hashing techniques implemented inside the PhishGuard backend service.

---

## 🔒 Password Security & Hashing

Passwords are **never** stored in plaintext or reversible encryption. We adhere strictly to OWASP security guidelines:
* **Algorithm**: We use **Argon2id** (via `pwdlib[argon2]`), a modern, slow, memory-hard key derivation function specifically designed to resist GPU-based brute-force cracking.
* **Salts**: Every password hash is generated with a unique, cryptographically strong salt managed internally by Argon2.
* **Logging Controls**: Authentication requests and passwords are explicitly excluded from application logs to prevent credentials leaking.

---

## 🔑 JWT Authentication Flow

Protected API endpoints use OAuth2 bearer authorization tokens.
* **Token Lifespan**: Access tokens are short-lived (defaulting to 30 minutes) and highly configurable via environment variables (`ACCESS_TOKEN_EXPIRE_MINUTES`).
* **Cryptographic Signature**: Tokens are signed with a securely configured `JWT_SECRET_KEY` using the `HS256` symmetric signing algorithm.
* **Claims**:
  * `sub`: Contains the unique User UUID (never names or sensitive email details).
  * `role`: User authorization level (`user` or `admin`).
  * `iat`: Unix timestamp indicating token issuance.
  * `exp`: Unix timestamp indicating expiration.

---

## 🛡️ Error Safety & Diagnostics

For login/authentication failures:
* **Generic Responses**: We return a generic `"Invalid email or password"` detail instead of revealing whether the user email existed or was inactive.
* **Stack Traces**: SQLAlchemy engine exceptions, hashing driver issues, and decoding errors are caught internally. They return generic user-facing validation errors rather than leaking internals.

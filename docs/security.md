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

## 🛡️ Production Security Middlewares

FastAPI registers a multi-layered middleware stack ensuring defense-in-depth:

### 1. Trusted Host header verification
* **Middleware**: `TrustedHostMiddleware`
* **Purpose**: Prevents HTTP Host Header poisoning.
* **Controls**: Disallows wildcard hosts `["*"]` in production. Only explicit domains configured in `ALLOWED_HOSTS` are accepted.

### 2. Request Payload Size Checks
* **Middleware**: Custom ASGI `RequestSizeLimitMiddleware`
* **Purpose**: Prevents memory buffer flooding (Denial of Service).
* **Controls**: Limits request bodies to a maximum of 1MB (`1,048,576` bytes). Rejects oversized requests immediately using `Content-Length` headers where available, and limits chunked streams with a bounded body reader wrapper.

### 3. API CORS Hardening
* **Middleware**: `CORSMiddleware`
* **Purpose**: Safe cross-origin resource sharing.
* **Controls**: Restricts origins strictly to configured arrays. Wildcard CORS origins are forbidden in production. Restricts request methods to `GET, POST, DELETE, OPTIONS`.

### 4. Sliding Window Rate Limiting
* **Limiter**: Custom thread-safe `InMemoryRateLimiter`
* **Purpose**: Abuse and route flooding protection.
* **Controls**: Implements separate rate thresholds:
  * `login`: 5 requests per minute
  * `register`: 3 requests per minute
  * `scans`: 10 requests per minute
  * `feedback`: 5 requests per minute
  * `general`: 60 requests per minute
* **Production Warning**: In-memory rate limiting is process-isolated. For distributed multi-worker topologies, rate limits must be offloaded to an API Gateway (e.g. Nginx, Cloudflare) or a shared storage backend (e.g., Redis).

---

## 🛡️ Unhandled Exception Masking & Request IDs

* **Correlation IDs**: Every request receives a unique UUID propagated via the `X-Request-ID` header.
* **Stack Trace Protection**: Global exception handlers intercept unhandled `Exception` states. Unexpected failures log full trace details internally with the Request ID, but return a generic `HTTP 500` error envelope to the user. Database paths, connection credentials, model locations, and secret values are masked.
* **Validation & HTTP Statuses**: Normal HTTP status exceptions (401, 403, 404, 429) and validator errors (422) remain unmasked.

---

## 🛡️ Sensitive Logging Policies

Structured logs written to stdout follow strict sanitization:
* Logs record only method, path, request ID, duration, and status code.
* **Forbidden variables**: Passwords, authorization tokens, complete email bodies, uploaded file contents, and raw database trace strings are **never** logged.

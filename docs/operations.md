# PhishGuard Operational Administration & Deployment Guide

This document describes operations, environment variables, rate limit configurations, and staging verification checks.

---

## ⚙️ Environment Configuration

PhishGuard relies on system environment variables for configuration. Below is a reference for staging/production deployments:

| Variable Name | Default Value | Production Requirement |
| :--- | :--- | :--- |
| `APP_ENV` | `development` | Set to `production` to trigger strict settings checks. |
| `DATABASE_URL` | `postgresql+psycopg://...` | Connection string for PostgreSQL database. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Explicit domain list of the API host. Empty list is rejected in production. |
| `ALLOWED_CORS_ORIGINS`| `http://localhost:5500` | Comma-separated client origins. Wildcard `*` is rejected in production. |
| `JWT_SECRET_KEY` | `replace-with-a-long-...`| Must be updated to a secure cryptographically random key. Default key is rejected in production. |
| `MAX_REQUEST_BODY_BYTES`| `1048576` (1MB) | Maximum allowed payload size. |
| `RATE_LIMIT_ENABLED` | `true` | Enables/disables rate-limiting checks. |
| `LOG_LEVEL` | `INFO` | Standard Python logging levels (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |

---

## 🔒 Security Headers Reference

The backend adds the following security headers to all responses:
* `X-Content-Type-Options: nosniff` (Prevents MIME sniffing attacks)
* `X-Frame-Options: DENY` (Clickjacking protection)
* `Referrer-Policy: strict-origin-when-cross-origin` (Protects referrer data across origins)
* `Permissions-Policy: geolocation=(), microphone=(), camera=()` (Disables access to device APIs)
* `Cache-Control: no-store, max-age=0, must-revalidate` (Forces proxies to re-fetch sensitive assets)
* `Strict-Transport-Security` (Only active when the request is served over HTTPS)

---

## ⏱️ Rate Limiting & Scaling

PhishGuard uses sliding windows to track client query rates:
* **Identification**: Identifies clients using IP addresses (from `X-Forwarded-For` header if behind a trusted proxy) or their User ID.
* **Response**: Exceeded thresholds return `HTTP 429 Too Many Requests` containing a `Retry-After` header indicating the cooldown period in seconds.

### Single-Process vs. Multi-Worker Scaling
The included `InMemoryRateLimiter` keeps records in process memory:
* **Suitability**: Local development and single-process staging deployments.
* **Limitations**: If running multiple Uvicorn worker replicas (`--workers 4`) or scaling horizontally (multiple containers), state is not shared between processes. A client could bypass limits by hit-routing across different workers.
* **Production Scaling**:
  1. **Redis implementation**: Modify the limiter to query a shared Redis store (using Redis keys set to expire automatically).
  2. **Proxy delegation**: Turn off `RATE_LIMIT_ENABLED` in settings and configure rate limiting at the reverse proxy (e.g. Nginx `limit_req` directive) or API Gateway level.

---

## 📦 Request Size Protections

* **Constraint**: 1MB maximum payload.
* **Checks**:
  * **Header check**: If the `Content-Length` header exceeds `MAX_REQUEST_BODY_BYTES`, the connection is immediately aborted, returning an `HTTP 413 Content Too Large` error.
  * **Stream check**: If `Content-Length` is missing or spoofed, a bounded reader proxy intercepts the receive stream, raising an error if chunk size aggregation exceeds the threshold.

---

## 🛑 Unhandled Error Masking & Logs Audit

* **Errors Policy**: Stack traces are hidden from users. All unhandled errors return a generic `{"detail": "An unexpected server error occurred.", "request_id": "UUID"}` payload.
* **Logging Audit**: Sensitive parameters are excluded from log formatting. Raw passwords, authentication tokens, authorization headers, database connection parameters, and full email bodies are **never** logged.
* **Correlation**: Use the returned `request_id` in user error messages to locate traceback contexts in the backend stdout logs.

# PhishGuard Backend Service API Gateway

The backend service is built using FastAPI, SQLAlchemy 2.x, and PostgreSQL. It exposes endpoints for real-time machine learning predictions, analysis verdicts, dashboard aggregates, and user history logs.

---

## ⚙️ Environment Variables Configuration

Setup your local environment configurations inside a `.env` file located in the `backend/` directory. (See [`.env.example`](.env.example) for template configuration tokens):

```env
APP_NAME=PhishGuard API
APP_ENV=development
ALLOWED_CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
ALLOWED_HOSTS=localhost,127.0.0.1,testserver
DATABASE_URL=postgresql+psycopg://phishguard:replace-password@localhost:5432/phishguard
DATABASE_ECHO=false
TEST_DATABASE_URL=sqlite+pysqlite:///./test.db
JWT_SECRET_KEY=replace-with-a-long-random-development-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
MAX_REQUEST_BODY_BYTES=1048576
RATE_LIMIT_ENABLED=true
LOG_LEVEL=INFO
```

> [!WARNING]
> * Never commit `.env` containing real credentials to source control. `.env` is ignored by default in our `.gitignore` configuration.
> * If `APP_ENV=production`, setting default fallback values for `JWT_SECRET_KEY` or using wildcard CORS `*` will cause the application to fail fast on startup.

---

## 🔒 Production Hardening & Middleware Stack

We have configured several security middleware layers in FastAPI to protect endpoints:

### 1. Trusted Hosts
Restricts HTTP Host headers to allowed domains configured in `ALLOWED_HOSTS` via FastAPI's `TrustedHostMiddleware`.

### 2. Request Size Limits
Restricts request body payloads to `MAX_REQUEST_BODY_BYTES` (default 1MB / `1,048,576` bytes). Rejects oversized requests early via `Content-Length` headers, and wraps streaming read channels in a bounded proxy to prevent out-of-memory crashes on chunked payloads.

### 3. sliding Window Rate Limiting
Controls route flooding with separate sliding window thresholds:
* **Login**: Max 5 attempts/minute
* **Registration**: Max 3 attempts/minute
* **Scans**: Max 10 attempts/minute
* **Feedback**: Max 5 feedbacks/minute
* **General**: Max 60 queries/minute

> [!WARNING]
> The current rate limiter uses an **in-memory sliding window** designed for local development or single-process staging. If scaling to multiple production workers or container replicas, rate limits should be offloaded to an API Gateway (e.g. Nginx, Cloudflare) or a shared storage store like Redis.

### 4. Correlation / Request IDs
Injects a unique `X-Request-ID` UUID into all requests, logging method paths, durations, and exceptions mapped to this identifier.

### 5. Safe Global Exception Masking
Unhandled 500-level exceptions are caught, logged internally with a correlation ID, and masked to return a safe generic message without leaking stack traces, SQLAlchemy details, path configurations, or backend secrets. Normal `HTTPException` and validation errors remain useful.

---

## 💾 Database Migrations vs `create_all()`

We manage database schemas exclusively using **Alembic migrations** in production rather than `Base.metadata.create_all()`.
* **Why Alembic?**: `create_all()` is safe only for initial scratch development. It cannot handle schema updates (e.g., adding or modifying columns, constraints) without dropping existing data tables. Alembic tracks evolutionary versions to upgrade database schemas non-destructively.
* **Credentials Protection**: Connection passwords are loaded strictly from the system environment at runtime, avoiding hardcoded string credentials inside repository files or migration scripts.

---

## 🛠️ Local Development Setup

1. **Virtual Environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. **Install Packages & Dev Tools**:
   ```bash
   pip install -r requirements.txt
   pip install ruff pytest
   ```
3. **Format Check**:
   ```bash
   # Check code formatting compliance
   ruff format --check backend
   
   # Apply formatting changes automatically
   ruff format backend
   ```
4. **Lint Check**:
   ```bash
   # Analyze codebase style and imports ordering rules
   ruff check backend
   
   # Automatically fix auto-repairable issues
   ruff check backend --fix
   ```
5. **Run Unit Tests**:
   Since the PYTHONPATH is configured globally in `pyproject.toml`, run pytest directly inside the `backend` folder:
   ```bash
   python -m pytest tests/ -v
   ```

---

## 🗄️ Database Model Architecture

We use **SQLAlchemy 2.x typed declarative models** mapped to four primary entities:

### 1. User (`users` Table)
* Represents registered users. Password hashes are stored (never plaintext).
* **Cascades**: Deleting a user sets `user_id` to `NULL` on their scans (`SET NULL`), maintaining anonymized scan metrics. However, deleting a user deletes their associated feedback entries (`CASCADE`).

### 2. Scan (`scans` Table)
* Caches explainable risk prediction parameters.
* **Privacy Controls**: 
  * Does not store raw email bodies, payloads, attachment files, OTPs, or passwords.
  * Sender and recipient details are restricted to domains only (`sender_domain`, `recipient_domain`).
  * Subjects are truncated to a short preview length.

### 3. Feedback (`feedbacks` Table)
* Collects correctness reviews. Users can submit one feedback review per scan (`uq_feedbacks_user_scan`).
* **Cascades**: Deleting a scan automatically cascading-deletes associated feedback (`CASCADE`).

### 4. ModelVersion (`model_versions` Table)
* Tracks active models, algorithms, and validation metrics JSON.

---

## 🔒 Constraints and Indexes

* **Unique Constraints**: `uq_users_email`, `uq_feedbacks_user_scan`, `uq_model_versions_version`.
* **Value Checks**: 
  * `ck_scans_risk_score` (0 to 100)
  * `ck_scans_confidence` (0.0 to 1.0)
  * `ck_scans_legitimate_probability` / `ck_scans_phishing_probability` (0.0 to 1.0)
  * `ck_scans_processing_time` (non-negative)
  * `ck_scans_high_severity_count` (<= indicator_count)
* **Indexes**: Indexed columns include `users.email`, `scans.user_id`, `scans.created_at`, `feedbacks.scan_id`, `feedbacks.user_id`, and `model_versions.is_active`.

---

## 🔑 Authentication Security & OAuth2

We support OAuth2 Bearer authorization with short-lived JSON Web Tokens (JWT) and secure password verification:
* **Hashed Passwords**: Password verification uses **Argon2id** algorithm wrappers, preventing plaintext storage or credential leakages in logs.
* **Environment Variables**: JWT tokens are signed using `JWT_SECRET_KEY` configured locally inside `.env`.
* **API Endpoints**:
  * `POST /api/v1/auth/register` (JSON payload)
  * `POST /api/v1/auth/login` (`application/x-www-form-urlencoded` form payload)
  * `GET /api/v1/auth/me` (Protected profile resolver)

For full details, please refer to:
* [Security Design Document](../docs/security.md)
* [Operations Reference Guide](../docs/operations.md)

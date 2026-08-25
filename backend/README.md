# PhishGuard Backend Service API Gateway

The backend service is built using FastAPI, SQLAlchemy 2.x, and PostgreSQL. It exposes endpoints for real-time machine learning predictions, analysis verdicts, dashboard aggregates, and user history logs.

---

## ⚙️ Environment Variables configuration

Setup your local environment configurations inside a `.env` file located in the `backend/` directory. (See [`.env.example`](.env.example) for template configuration tokens):

```env
APP_NAME=PhishGuard API
APP_ENV=development
DATABASE_URL=postgresql+psycopg://phishguard:replace-password@localhost:5432/phishguard
DATABASE_ECHO=false
TEST_DATABASE_URL=sqlite+pysqlite:///./test.db
```

> [!WARNING]
> Never commit `.env` containing real credentials to source control. `.env` is ignored by default in our `.gitignore` configuration.

---

## 💾 Database migrations vs `create_all()`

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
2. **Install Packages**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run Unit Tests**:
   ```bash
   $env:PYTHONPATH="backend"; python -m pytest
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


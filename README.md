# PhishGuard — Explainable Phishing & Fraud Email Detection

PhishGuard is an explainable machine-learning-driven phishing and fraud email detection application. It integrates a responsive frontend web terminal, a FastAPI backend services API gateway, PostgreSQL database storage, Alembic migrations, and security hardening features.

---

## 🚀 Quick Start with Docker Compose

Ensure you have Docker and Docker Compose installed.

### 1. Launch Development Stack
Run the development services with hot-reloading:
```bash
# Build layers
docker compose -f docker-compose.dev.yml build

# Start database
docker compose -f docker-compose.dev.yml up -d db

# Run initial Alembic migrations
docker compose -f docker-compose.dev.yml run --rm migrate

# Run the API
docker compose -f docker-compose.dev.yml up
```
The backend API service will start on `http://localhost:8000`.

### 2. Launch Staging Stack
Run staging configurations (production-like limits, rate limiting, and CORS verification active):
```bash
# Start PostgreSQL db in background
docker compose -f docker-compose.staging.yml up -d db

# Run Alembic migrations and exit
docker compose -f docker-compose.staging.yml run --rm migrate

# Start FastAPI api in background
docker compose -f docker-compose.staging.yml up -d api
```

### 3. Open the Frontend
Once the backend is running, open `frontend/index.html` directly in your browser or serve it using a local static file server (e.g. Live Server on port 5500).

---

## 📁 Repository Structure

* **[`backend/`](backend/)**: FastAPI REST API, model execution pipelines, unit testing suites, and Alembic database versioning.
* **[`frontend/`](frontend/)**: UI dashboard modules served as lightweight vanilla HTML5, CSS3, and JavaScript files.
* **[`docs/`](docs/)**: Architecture documentation including security guidelines, API schemas, and deployment settings.

---

## ⚙️ Environment Settings

Copy [`.env.example`](.env.example) to `.env` inside the root or backend folder to adjust default settings.

---

## 🛡️ Staging Verification Checks

To verify that the container stack is active:
1. **Health Check**: Query `http://localhost:8000/health` (returns API status and DB connectivity check).
2. **Access Isolation**: Verify the API runs under user UID `1000` (non-root):
   ```bash
   docker compose -f docker-compose.staging.yml exec api whoami
   # Output: phishguard
   ```
3. **Database Isolation**: Try connecting to port `5432` from the host machine during staging runs. The connection should be rejected, as PostgreSQL is only accessible inside container service networks.

# PhishGuard Staging & Production Deployment Guide

This document describes Docker prerequisites, container build instructions, Compose service topologies, staging environment configurations, HTTPS/TLS reverse-proxy rules, HSTS parameters, PostgreSQL backup/restore verification, rollback strategies, and smoke testing procedures.

---

## 📋 Docker Prerequisites

Ensure the following tools are installed on your deployment server:
1. **Docker Engine**: v20.10+
2. **Docker Compose**: v2.0+

---

## 📦 Container Service Architecture

We define separate topologies for local development and staging/production replicas:

```
                  [ Staging Topology ]

            Host port: 8000 (HTTPS TLS termination proxy)
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ phishguard-api-stage  │  (FastAPI)
                     └───────────────────────┘
                                 │
           Wait for db health    │   Wait for migration completion
           & migration completed │
                                 ▼
                     ┌───────────────────────┐
                     │ phishguard-db-stage   │  (PostgreSQL - Port Isolated)
                     └───────────────────────┘
                                 ▲
                                 │
                     ┌───────────────────────┐
                     │ phishguard-migrate    │  (Alembic - Runs once & exits)
                     └───────────────────────┘
```

---

## 🛠️ Docker Compose Configurations

We provide two compose files at the root of the workspace:

### 1. Local Development (`docker-compose.dev.yml`)
* Maps local directories to enable auto-reload development.
* Publishes PostgreSQL port `5432:5432` for local inspection tools.
* Uses local volume `phishguard_postgres_data_dev`.

### 2. Staging Deployment (`docker-compose.staging.yml`)
* Binds API without development mounts.
* Isolates PostgreSQL port `5432` inside internal Compose networks (not exposed to the host).
* Implements container health checks testing `/health`.
* Integrates automated migrations hook (`migrate` service) waiting for PostgreSQL readiness before starting Uvicorn.

---

## 🚀 Deployment Commands

### Build Images
To rebuild container layers cleanly:
```bash
docker compose -f docker-compose.dev.yml build
```

### Run Local Development
To launch the database, run migrations, and start Uvicorn reload processes:
```bash
# Start PostgreSQL db
docker compose -f docker-compose.dev.yml up -d db

# Run Alembic migrations
docker compose -f docker-compose.dev.yml run --rm migrate

# Start FastAPI api
docker compose -f docker-compose.dev.yml up
```

### Run Staging
To launch the staging replicas:
```bash
# Start PostgreSQL db in background
docker compose -f docker-compose.staging.yml up -d db

# Run Alembic migrations and exit
docker compose -f docker-compose.staging.yml run --rm migrate

# Start FastAPI api in background
docker compose -f docker-compose.staging.yml up -d api
```

### Stop Services
To pause container executions:
```bash
docker compose -f docker-compose.dev.yml down
```

### Reset Database Volume
⚠️ **CAUTION**: Deleting the volume permanently purges all local tables, schemas, and statistics history. Only run this for clean local resets:
```bash
docker compose -f docker-compose.dev.yml down -v
```

---

## 🩺 Health Check Details

* **PostgreSQL Health Check**: Uses `pg_isready -U phishguard -d phishguard` inside the container. Ensures Uvicorn does not attempt queries before PG is fully initialized.
* **FastAPI API Health Check**: Calls the `/health` endpoint every 15 seconds. Verifies the status is `healthy` and the database connection check returns `available`.

---

## 🔑 HTTPS / TLS Reverse-Proxy Configurations

Do **not** expose plain HTTP ports directly to public clients in staging or production.
* **TLS Termination**: Offload TLS encryption at the edge (Nginx, Traefik, AWS ALB, Cloudflare, or Render/Railway load balancers).
* **Forwarded Headers**: Ensure the reverse proxy forwards headers correctly to allow FastAPI to detect HTTPS connections:
  * `X-Forwarded-Proto: https`
  * `X-Forwarded-For: <client_ip>`
* **Nginx Configuration Example**:
  ```nginx
  server {
      listen 443 ssl;
      server_name api-staging.example.com;

      ssl_certificate /etc/letsencrypt/live/api-staging.example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/api-staging.example.com/privkey.pem;

      location / {
          proxy_pass http://localhost:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```

---

## 🛡️ Cautious HSTS Deployment Checklist

HTTP Strict Transport Security (HSTS) tells browsers to **only** access the domain via HTTPS.
* ⚠️ **WARNING**: If HSTS is enabled before HTTPS is fully operational and verified, browsers will reject connections, locking out users.
* **HSTS Parameters (Configurable via environment)**:
  * `ENABLE_HSTS`: Set to `true` **only** in environments with active SSL certificates. Keep `false` on localhost.
  * `HSTS_MAX_AGE`: Set to a conservative low value first in staging (e.g., `86400` seconds / 1 day) before ramping up to production values (`31536000` / 1 year).
  * `HSTS_INCLUDE_SUBDOMAINS`: Keep `false` unless **every** subdomain has verified SSL.
  * `HSTS_PRELOAD`: Keep `false` unless you explicitly want to submit the domain to the Chrome HSTS preload list (irreversible process).

---

## 📋 Domain & DNS Checklist

Before deploying, ensure the following records are published:

| Record Type | Hostname / Subdomain | Target / Value | Purpose |
| :--- | :--- | :--- | :--- |
| **A** | `api-staging.example.com` | VPS Staging IP Address | Points to the backend gateway |
| **A** | `staging.example.com` | Frontend Staging IP Address | Points to client dashboard UI |
| **TXT** | `staging.example.com` | Let's Encrypt / ACME verification | Automated TLS validation |

---

## 🗄️ Database Migrations in Staging

Alembic migrations must run **sequentially** through the dedicated `migrate` service to prevent race conditions:
1. Confirm PG database service is healthy.
2. Execute:
   ```bash
   docker compose -f docker-compose.staging.yml run --rm migrate
   ```
3. Verify current revision:
   ```bash
   docker compose -f docker-compose.staging.yml run --rm migrate alembic current
   ```
4. Start API services after migrations complete successfully.

---

## 💾 Database Backups & Restore Verification

### 1. PostgreSQL Backup Command
To back up the staging database non-destructively:
```bash
# Export schema and data as a compressed custom format archive
docker compose -f docker-compose.staging.yml exec -t db pg_dump -U phishguard -d phishguard --format=custom --file=/tmp/backup_phishguard_$(date +%Y%m%d%H%M%S).dump
```
Ensure backups are downloaded and stored securely off-site (e.g., AWS S3 with encryption at rest).

### 2. Restore Verification Procedure
Never restore backups directly over a live database without verification.
1. Start a disposable testing container:
   ```bash
   docker run --name pg-test-restore -e POSTGRES_PASSWORD=restorepass -e POSTGRES_DB=phishguard_restore -d postgres:15-alpine
   ```
2. Copy the backup dump file into the container:
   ```bash
   docker cp backup_phishguard.dump pg-test-restore:/tmp/backup.dump
   ```
3. Run `pg_restore` to restore the schema:
   ```bash
   docker exec -it pg-test-restore pg_restore -U postgres -d phishguard_restore /tmp/backup.dump
   ```
4. Verify table and migration version row counts:
   ```bash
   docker exec -it pg-test-restore psql -U postgres -d phishguard_restore -c "SELECT * FROM alembic_version;"
   ```
5. Teardown the disposable container:
   ```bash
   docker stop pg-test-restore && docker rm pg-test-restore
   ```

---

## 🚦 Rollback Procedures

If a staging release fails health checks or smoke tests:
1. **Stop the Failed API Container**:
   ```bash
   docker compose -f docker-compose.staging.yml stop api
   ```
2. **Revert Image Version**: Update the image tag in `docker-compose.staging.yml` to the previously validated container image.
3. **Database Schema Rollbacks**:
   * If a migration failed or database schema changes need reversion, consult the backup created before the release.
   * If rollback requires database restore, perform restore verification steps first before dropping the live staging schema.
   * **Do not automate destructive downgrades**; schema restores must be verified and approved by the database owner.
4. **Restart Services**:
   ```bash
   docker compose -f docker-compose.staging.yml up -d api
   ```

---

## 🩺 Staging Smoke Tests Checklist

Verify the following items on staging deployment:
* [ ] `/health` returns `healthy` and database status `available`.
* [ ] Registration of new user returns JSON without exposing `password_hash`.
* [ ] Login with form data returns valid JWT access token.
* [ ] `/auth/me` resolves the user details based on bearer header.
* [ ] Guest scan submits emails, returning classification output.
* [ ] Authenticated scan saves record in history.
* [ ] Pagination and dashboard endpoints populate correctly.
* [ ] Request size limit rejects bodies > 1MB (`HTTP 413`).
* [ ] Rate limiting rejects rapid login attempts (`HTTP 429`).
* [ ] Unhandled exception handler masks internal system details (`HTTP 500`).
* [ ] Frontend static pages load without mixed-content console warnings.

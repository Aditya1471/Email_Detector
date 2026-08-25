# PhishGuard Staging & Production Deployment Guide

This document describes Docker prerequisites, container build instructions, Compose service topologies, migration hooks, and database troubleshooting procedures.

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

## 🗄️ Database Migrations Workflow

Migrations must run **sequentially** through the dedicated `migrate` service to prevent race conditions (e.g. two Uvicorn worker threads executing `alembic upgrade head` simultaneously):
1. The `migrate` service applies `alembic upgrade head`.
2. **Downgrades Warning**: Avoid automatic Alembic downgrades in production scripts. Perform downgrades manually only after creating complete SQL database backups.

---

## 🔍 Troubleshooting & Verification

### 1. Check Container Status
```bash
docker compose -f docker-compose.dev.yml ps
```

### 2. Inspect Service Logs
```bash
# View API server output
docker compose -f docker-compose.dev.yml logs api

# View PostgreSQL log traces
docker compose -f docker-compose.dev.yml logs db
```

### 3. Verify Non-Root User Execution
Connect to the API container and run `whoami` to verify that the server does not run as root:
```bash
docker compose -f docker-compose.staging.yml exec api whoami
# Output must be: phishguard
```

### 4. Database Connection Failures
If the API fails to connect to PostgreSQL:
* Verify the database hostname inside your `DATABASE_URL` is set to `db` (the Compose service name) and **not** `localhost`.
* Ensure that the PostgreSQL health check has passed before starting the API.

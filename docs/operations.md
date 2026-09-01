# PhishGuard Background Worker & Queue Operations Guide

## 1. Starting the Worker

### Development Mode (Local CLI)
```powershell
# In backend directory:
celery -A app.worker.celery_app worker --loglevel=INFO --concurrency=1
```

### Docker Compose
```powershell
# Development stack:
docker compose -f docker-compose.dev.yml up -d worker redis

# Staging stack:
docker compose -f docker-compose.staging.yml up -d worker redis
```

---

## 2. Inspecting Queued Tasks & Worker Logs

### View Celery Worker Logs
```powershell
# Live container stream:
docker logs -f phishguard-worker-dev
```

### Check Redis Health
```powershell
docker exec -it phishguard-redis-dev redis-cli ping
# Expected: PONG
```

---

## 3. Operations & Recovery Workflows

### Worker Restarts
* Celery is configured with `task_acks_late=True` and `task_reject_on_worker_lost=True`.
* If a worker container abruptly crashes or restarts mid-job, the unacknowledged task is returned to the Redis queue and re-executed safely.

### Handling Transient Provider Failures
* Transient Google API or Twilio network drops automatically trigger exponential backoff retries up to `MAX_JOB_RETRIES=3`.
* Failed jobs record a sanitized `error_code` in the `background_jobs` table.

### Global SMS Kill-Switch
To immediately halt outbound SMS notifications across the entire platform:
```env
SMS_ALERTS_ENABLED=false
```
Restart the API and worker containers to apply immediately.

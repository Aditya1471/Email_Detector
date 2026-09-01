# PhishGuard Asynchronous Processing & Background Worker Architecture

## 1. Overview
PhishGuard offloads slow, network-dependent, and retry-critical operations from the HTTP request-response cycle into durable background tasks powered by **Celery** with a **Redis** message broker and result backend.

---

## 2. Queue & Worker Pipeline

```
  Client Request (POST /api/v1/integrations/gmail/sync)
         │
         ▼
  FastAPI API Server
         │  1. Verifies authentication & active Gmail integration
         │  2. Creates BackgroundJob (status="queued")
         │  3. Dispatches task to Redis queue
         ▼  4. Returns HTTP 202 Accepted { job_id: "...", status: "queued" }
  Redis Broker (redis://redis:6379/0)
         │
         ▼
  Celery Worker Process (backend/app/worker.py)
         │  5. Sets BackgroundJob status="running"
         │  6. Fetches recent inbox messages (in:inbox newer_than:1d)
         │  7. Parses MIME body in memory (enforcing 50 KB ceiling)
         │  8. Runs URL feature extraction & ML inference
         │  9. Stores MonitoredMessage summary
         │ 10. Enqueues SMS notification task if risk >= threshold
         ▼ 11. Sets BackgroundJob status="completed" with execution metrics
  Client Polling (GET /api/v1/jobs/{job_id})
         12. Retrieves execution status & statistics
```

---

## 3. Job Types & Lifecycle

| Job Type | Description | Idempotency Key | Max Retries |
|---|---|---|---|
| `gmail_sync` | Manual mailbox inspection & ML analysis | `integration_id` + `status in ('queued', 'running')` | 3 |
| `sms_delivery` | High-risk SMS security alert dispatch | `(user_id, monitored_message_id, channel='sms')` | 3 |
| `token_refresh` | OAuth token refresh prior to mailbox API queries | `integration_id` | 3 |

### Job Status States
* **`queued`**: Job created in database and submitted to broker.
* **`running`**: Worker actively executing task.
* **`completed`**: Finished successfully with result summary recorded.
* **`failed`**: Permanent failure or retry budget exhausted.
* **`retrying`**: Temporary network failure encountered; scheduled for backoff.
* **`cancelled`**: Job cancelled (e.g. integration was paused).

---

## 4. Privacy & Data Protection Safeguards
* **Zero Full Body Storage**: Workers process MIME structures in memory and immediately discard them.
* **No Secrets in Payloads**: Task arguments only contain UUID identifiers (`job_id`, `integration_id`, `user_id`, `message_id`). Credentials are decrypted on-demand within worker memory.
* **Safe Error Logging**: Stack traces and error messages are sanitized to omit tokens, emails, or PII.

---

## 5. Development vs. Production Execution

```env
# Enable Celery Redis queue in staging/production:
QUEUE_ENABLED=true
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
WORKER_CONCURRENCY=1
```

When `QUEUE_ENABLED=false` (e.g. local lightweight development without Redis), PhishGuard executes background jobs synchronously using deterministic in-process runners while maintaining full database audit records.

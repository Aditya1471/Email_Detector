# Gmail Manual Synchronization Architecture

## Overview
PhishGuard supports on-demand, defensive security inspection of a user's connected Gmail Inbox. When the user initiates a manual check (**"Check for New Emails"**), the backend safely synchronizes a bounded window of recent Inbox messages, evaluates them using the PhishGuard machine learning and heuristic pipeline, and persists explainable risk summaries.

---

## Technical Data Flow

```
                     [ Manual Synchronization Pipeline ]

  Frontend UI
     │
     │ 1. User clicks "Check for New Emails" (POST /api/v1/integrations/gmail/sync)
     ▼
  FastAPI API Gateway
     │
     │ 2. Authenticates JWT & verifies integration ownership
     │ 3. Decrypts OAuth credentials using TokenEncryptionService
     ▼
  MailboxSyncService
     │
     │ 4. GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox newer_than:1d
     │ 5. Filters out existing provider_message_ids (Idempotency)
     │ 6. Fetches message MIME payloads
     ▼
  EmailParser
     │
     │ 7. Extracts Subject, Sender Domain, Recipient Domain, Plaintext Body & URLs (in-memory)
     ▼
  PhishGuard Detection Pipeline
     │
     │ 8. URLAnalyzer -> IndicatorService -> PredictionService (Blended ML Risk Score)
     ▼
  Database Layer
     │
     │ 9. Persists MonitoredMessage summaries (Zero full email bodies stored)
     │ 10. Updates integration.last_sync_cursor & updated_at
     ▼
  Frontend UI
     11. Displays real-time summary (newly processed, skipped, high-risk detections)
```

---

## Privacy & Security Bounds

1. **Restricted Read-Only Scope**: Only `https://www.googleapis.com/auth/gmail.readonly` is requested.
2. **Zero Modification**: PhishGuard cannot send, delete, move, or modify emails in any way.
3. **No Complete Body Persistence**: Message bodies are parsed and analyzed purely in volatile memory. Only risk score, classification, indicator counts, sender domain, and truncated safe subject previews are persisted.
4. **No Attachment Execution**: Attachments are never downloaded, opened, or executed.
5. **No Active Link Crawling**: URLs are extracted and graded statically without visiting third-party servers.
6. **Encrypted Credentials**: Provider access and refresh tokens are encrypted at rest with Fernet (AES-128-CBC + HMAC-SHA256).
7. **Idempotency**: Unique constraint on `(integration_id, provider_message_id)` prevents duplicate processing.

---

## Configuration Settings

```env
GMAIL_SYNC_MAX_MESSAGES=20
GMAIL_SYNC_LOOKBACK_HOURS=24
GMAIL_SYNC_QUERY=in:inbox newer_than:1d
```

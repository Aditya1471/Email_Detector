# Microsoft Outlook & Microsoft Graph Integration Architecture

## 1. Overview & Defensive Scope
PhishGuard's Microsoft Outlook integration provides explainable, privacy-preserving threat detection for Microsoft 365 and Outlook.com mailboxes.

It operates strictly on **minimal delegated permissions**:
- `openid`, `profile`, `email`: Identity and authentication context.
- `offline_access`: Token refresh capability without re-prompting the user.
- `User.Read`: Retrieve profile and stable Microsoft Graph user identifier (`id`).
- `Mail.Read`: Read-only access to messages in the Inbox.

**Explicit Operational Boundaries**:
- **Zero Write/Modify/Send/Delete Permissions**: PhishGuard cannot send, delete, move, or modify any emails.
- **No Attachment Downloads/Execution**: Email attachments are neither downloaded nor executed.
- **No Active URL Fetching**: Destination servers are not contacted; URLs are evaluated purely heuristically.
- **Data Minimization**: Full message bodies are never written to database storage. Only in-memory sanitized text (under 50 KB) is analyzed, and only safe diagnostics and indicators are retained.

---

## 2. Stable Identifier Mapping
To ensure resilience against email address changes or aliasing:
1. `provider_account_id`: Populated with the stable Microsoft Graph user ID (`id` from `GET /v1.0/me`).
2. `email_address`: Populated with `mail` or `userPrincipalName` for user-facing display.

---

## 3. Subscription & Webhook Lifecycle
```
+-------------------+           +-----------------------+           +-------------------+
|  Microsoft Graph  |           |     PhishGuard API    |           |   Celery Worker   |
+-------------------+           +-----------------------+           +-------------------+
          |                                 |                                 |
          | 1. POST /webhook?validationToken|                                 |
          |-------------------------------->|                                 |
          | 2. 200 OK (text/plain body)     |                                 |
          |<--------------------------------|                                 |
          |                                 |                                 |
          | 3. POST /webhook (Notification) |                                 |
          |-------------------------------->|                                 |
          |                                 | 4. Validate clientState         |
          |                                 |    & Enqueue sync job           |
          |                                 |-------------------------------->|
          | 5. 202 Accepted                 |                                 |
          |<--------------------------------|                                 |
          |                                 |                                 | 6. Fetch recent msgs
          |                                 |<--------------------------------| 7. In-memory ML scan
```

### Webhook Validation (`POST /api/v1/integrations/outlook/webhook`)
- Responds to Microsoft Graph validation challenges immediately with `Content-Type: text/plain` containing the exact `validationToken`.
- Validation requests bypass JWT authentication.
- Incoming notifications verify `clientState` against the configured secret (`MICROSOFT_WEBHOOK_CLIENT_STATE`).
- Matching subscriptions enqueue background jobs (`outlook_sync`) without blocking on inline ML evaluation.

### Scheduled Subscription Renewal
- Microsoft Graph message subscriptions expire after ~3 days (4,230 minutes max).
- A Celery periodic task (`renew_outlook_subscriptions_job`) runs periodically to renew active subscriptions nearing expiration (< 24 hours remaining).
- Users can also trigger immediate renewal via `POST /api/v1/integrations/outlook/renew`.

---

## 4. Bounded In-Memory Analysis & Deduplication
- **Inbox Scope**: Only recent messages (`$top=20`, `$orderby=receivedDateTime desc`) are fetched.
- **50 KB In-Memory Ceiling**: Strips HTML using BeautifulSoup and enforces a 51,200 character cap.
- **Idempotency**: Checked by `(integration_id, provider_message_id)`. Existing message IDs are skipped cleanly.
- **High-Risk SMS Alerts**: If an analyzed email exceeds the risk threshold ($\ge 70$), a rate-limited SMS alert is dispatched via Twilio to verified, opted-in users.

---

## 5. Security & Secret Management
- **At-Rest Token Encryption**: Both `access_token` and `refresh_token` are encrypted with AES-128-CBC / HMAC-SHA256 (Fernet) via `token_encryption_service`.
- **Sensitive Field Protection**: Raw tokens, provider payloads, and authorization codes are never logged or exposed to the frontend.

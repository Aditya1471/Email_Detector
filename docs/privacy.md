# PhishGuard Privacy & Data Minimization Policy

PhishGuard is designed around strict privacy-preserving principles and defensive security practices.

---

## 1. Scope & Permissions
* **Gmail Scope**: `https://www.googleapis.com/auth/gmail.readonly`
* **Purpose**: Inspect incoming messages to detect phishing indicators, spoofed headers, and credential harvesting links.
* **Prohibited Capabilities**: PhishGuard has **no permission** to send, delete, move, or modify emails.

---

## 2. Data Storage Boundaries

| Data Item | Stored? | Storage Location & Encryption |
|---|---|---|
| Full Email Bodies | **NO** | Kept temporarily in memory during analysis, discarded immediately. |
| Attachments | **NO** | Never downloaded, stored, or executed. |
| Provider OAuth Tokens | **YES** | Encrypted at rest using AES/Fernet (`TOKEN_ENCRYPTION_KEY`). |
| Risk Scores & Verdicts | **YES** | Stored in `monitored_messages` (0–100 risk score, safe/suspicious/phishing). |
| Extracted Indicator Counts | **YES** | Stored in `monitored_messages` (count of flags and detected link count). |
| Truncated Subject Previews | **YES** | Stored in `monitored_messages` (truncated to maximum 100 characters). |
| Sender / Recipient Domains | **YES** | Stored in `monitored_messages` (e.g., `bank-security.xyz`). |

---

## 3. User Data Controls

* **Pause / Resume**: Users can pause inbox monitoring at any time (`POST /api/v1/integrations/gmail/pause`).
* **Purge Data**: Users can purge all stored scan summaries and monitored message metadata (`DELETE /api/v1/integrations/gmail/data`).
* **Disconnect Account**: Disconnecting revokes the OAuth token with Google and purges credentials from the database (`DELETE /api/v1/integrations/gmail`).

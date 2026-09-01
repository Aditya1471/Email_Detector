# PhishGuard SMS Notifications & Phone Verification Architecture

## Overview
PhishGuard provides high-priority, privacy-conscious SMS security alerts for connected mailboxes. When an incoming email exceeds the user's configured risk score threshold (default: 80/100), PhishGuard dispatches an instant mobile notification to alert the user before they interact with malicious content.

---

## 1. Phone Verification Lifecycle

```
 User Input (+12025550123)
       │
       ▼
 E.164 Normalization & Validation (NotificationService.validate_e164_phone)
       │
       ▼
 Encrypt & Mask at Rest (TokenEncryptionService / Fernet AES)
       │
       ▼
 Twilio Verify API (POST /v2/Services/{service_sid}/Verifications)
       │
       ▼
 User Submits One-Time Passcode (OTP)
       │
       ▼
 Twilio Verification Check (POST /v2/Services/{service_sid}/VerificationCheck)
       │
       ▼
 Verified Status Confirmed (is_phone_verified=True)
```

---

## 2. Explicit Opt-In Consent Policy

SMS notifications are **disabled by default**. To activate SMS notifications, a user must:
1. Complete phone verification via OTP.
2. Review clear messaging disclosures (purpose, message frequency, and carrier fee notices).
3. Explicitly select the opt-in checkbox (`consent_accepted=True`).

When consent is granted, the backend records:
* `consent_recorded_at`: UTC timestamp of consent.
* `consent_ip`: Client IP address at time of consent.

---

## 3. Privacy-Safe Alert Payload

Alert templates are strictly minimal and privacy-preserving. They **never** include email bodies, private text, subject lines, credentials, sender addresses, OTPs, or suspicious hyperlinks.

### Standard SMS Template
> "PhishGuard alert: A newly received email has a high phishing risk (Score: 95/100). Open PhishGuard to review warning indicators. Do not click links in the email."

---

## 4. Opt-Out & Revocation Controls

Users maintain full control over notification behavior:
* **Toggle SMS Off**: Sets `sms_alerts_enabled=False` and timestamps `opt_out_at`.
* **Pause Alerts**: Sets `alerts_paused=True` to temporarily suppress outbound SMS without deleting preferences.
* **Remove Phone**: Calls `DELETE /api/v1/notifications/phone` to permanently erase encrypted phone credentials.
* **Carrier Opt-Out**: Supports standard provider-level opt-out keywords (`STOP`, `UNSUBSCRIBE`, `CANCEL`).

---

## 5. Duplicate Suppression & Idempotency

Each monitored email message is assigned a unique `MonitoredMessage.id`. When evaluating delivery:
1. PhishGuard checks for existing `Notification` records matching `(user_id, monitored_message_id, channel="sms")`.
2. If an alert has already been dispatched, subsequent triggers are skipped cleanly.
3. Only eligible messages meeting or exceeding the user's `risk_threshold` generate an alert.

---

## 6. Environment Configuration

```env
# Twilio Integration & Credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Messaging Feature Flags
SMS_ALERTS_ENABLED=false
HIGH_RISK_ALERT_THRESHOLD=80
```

To disable SMS globally across the system, set `SMS_ALERTS_ENABLED=false`.

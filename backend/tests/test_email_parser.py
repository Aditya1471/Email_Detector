import base64

from app.services.email_parser import email_parser


def test_extract_domain():
    assert email_parser.extract_domain("John Doe <john.doe@company.org>") == "company.org"
    assert email_parser.extract_domain("alert@security-service.net") == "security-service.net"
    assert email_parser.extract_domain("invalid-string-no-at") is None
    assert email_parser.extract_domain("") is None


def test_clean_html_to_text():
    html_sample = "<html><body><p>Hello <b>World</b>!</p><script>alert('xss')</script><div>Click here</div></body></html>"
    text = email_parser.clean_html_to_text(html_sample)
    assert "Hello World!" in text
    assert "Click here" in text
    assert "alert" not in text
    assert "<" not in text


def test_parse_eml_content_plain_text():
    raw_eml = """From: support@paypal-notice.xyz
To: victim@example.com
Subject: Account Suspension Notice

Dear User, your account has been locked. Verify immediately."""

    parsed = email_parser.parse_eml_content(raw_eml)
    assert parsed["sender"] == "support@paypal-notice.xyz"
    assert parsed["recipient"] == "victim@example.com"
    assert parsed["subject"] == "Account Suspension Notice"
    assert "your account has been locked" in parsed["body"]


def test_parse_gmail_message_payload_plain_text():
    plain_body = "Urgent: Your account password expires today. http://phish-login.xyz"
    b64_body = base64.urlsafe_b64encode(plain_body.encode("utf-8")).decode("ASCII")

    gmail_msg = {
        "id": "189abc123",
        "payload": {
            "headers": [
                {"name": "From", "value": "Security Team <security@bank-alert.xyz>"},
                {"name": "To", "value": "Customer <user@example.com>"},
                {"name": "Subject", "value": "Urgent Account Notice"},
                {"name": "Date", "value": "Tue, 1 Sep 2026 12:00:00 +0000"},
            ],
            "mimeType": "text/plain",
            "body": {"data": b64_body},
        },
    }

    parsed = email_parser.parse_gmail_message_payload(gmail_msg)
    assert parsed["provider_message_id"] == "189abc123"
    assert parsed["sender"] == "Security Team <security@bank-alert.xyz>"
    assert parsed["sender_domain"] == "bank-alert.xyz"
    assert parsed["recipient_domain"] == "example.com"
    assert parsed["subject"] == "Urgent Account Notice"
    assert parsed["subject_preview"] == "Urgent Account Notice"
    assert "http://phish-login.xyz" in parsed["body"]


def test_parse_gmail_message_payload_html_only():
    html_body = "<html><body><p>Please update your billing info <a href='https://fake-billing.biz'>here</a>.</p></body></html>"
    b64_body = base64.urlsafe_b64encode(html_body.encode("utf-8")).decode("ASCII")

    gmail_msg = {
        "id": "189def456",
        "payload": {
            "headers": [
                {"name": "From", "value": "billing@fake-billing.biz"},
                {"name": "Subject", "value": "Invoice #4459"},
            ],
            "mimeType": "text/html",
            "body": {"data": b64_body},
        },
    }

    parsed = email_parser.parse_gmail_message_payload(gmail_msg)
    assert parsed["provider_message_id"] == "189def456"
    assert parsed["sender_domain"] == "fake-billing.biz"
    assert "Please update your billing info" in parsed["body"]


def test_parse_gmail_message_payload_multipart():
    plain_text = "Plain text version of email."
    html_text = "<p>HTML version of email.</p>"
    b64_plain = base64.urlsafe_b64encode(plain_text.encode("utf-8")).decode("ASCII")
    b64_html = base64.urlsafe_b64encode(html_text.encode("utf-8")).decode("ASCII")

    gmail_msg = {
        "id": "189multi789",
        "payload": {
            "headers": [
                {"name": "From", "value": "notifications@platform.com"},
                {"name": "Subject", "value": "Weekly Summary"},
            ],
            "mimeType": "multipart/alternative",
            "parts": [
                {"mimeType": "text/plain", "body": {"data": b64_plain}},
                {"mimeType": "text/html", "body": {"data": b64_html}},
            ],
        },
    }

    parsed = email_parser.parse_gmail_message_payload(gmail_msg)
    assert parsed["provider_message_id"] == "189multi789"
    assert parsed["sender_domain"] == "platform.com"
    # Prefers text/plain part
    assert "Plain text version of email." in parsed["body"]


def test_parse_gmail_message_payload_missing_headers():
    gmail_msg = {
        "id": "189empty",
        "payload": {
            "headers": [],
            "body": {},
        },
    }

    parsed = email_parser.parse_gmail_message_payload(gmail_msg)
    assert parsed["provider_message_id"] == "189empty"
    assert parsed["subject_preview"] == "(No Subject)"
    assert parsed["sender_domain"] is None
    assert parsed["body"] == ""

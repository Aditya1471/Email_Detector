from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_scan_safe():
    payload = {
        "sender": "colleague@organization-sandbox.com",
        "recipient": "team@organization-sandbox.com",
        "subject": "Project review sync slides discussion",
        "body": "Hi team, please review the slides before our synchronization meeting tomorrow at 2PM. Thanks!",
    }
    response = client.post("/api/v1/scans", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "scan_id" in data
    assert data["classification"] == "safe"
    assert data["risk_score"] < 35
    assert len(data["indicators"]) >= 1


def test_create_scan_phishing():
    payload = {
        "sender": "alert-spoof@fictional-bank-security.com",
        "recipient": "customer@sandbox-mail.com",
        "subject": "URGENT Account Limit hold suspension verification",
        "body": "Please confirm details immediately at http://fictional-bank-security-portal.xyz/login to lift hold details.",
    }
    response = client.post("/api/v1/scans", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "scan_id" in data
    assert data["classification"] == "phishing"
    assert data["risk_score"] >= 70


def test_create_scan_text_alias():
    payload = {
        "sender": "colleague@organization-sandbox.com",
        "recipient": "team@organization-sandbox.com",
        "subject": "Project review sync slides discussion",
        "body": "Hi team, please review the slides before our synchronization meeting tomorrow at 2PM. Thanks!",
    }
    response = client.post("/api/v1/scans/text", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "scan_id" in data
    assert data["classification"] == "safe"


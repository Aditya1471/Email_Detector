import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.feedback import Feedback
from app.models.scan import Scan
from app.models.user import User
from app.security.jwt import create_access_token

client = TestClient(app)


@pytest.fixture
def test_user_a(db_session):
    user = User(email="usera@example.com", password_hash="hashedpassword123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_a(test_user_a):
    return create_access_token(subject=str(test_user_a.id), role=test_user_a.role)


@pytest.fixture
def test_user_b(db_session):
    user = User(email="userb@example.com", password_hash="hashedpassword123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_b(test_user_b):
    return create_access_token(subject=str(test_user_b.id), role=test_user_b.role)


def test_create_scan_guest(db_session):
    # Guest scans should NOT write to database
    initial_count = db_session.query(Scan).count()
    payload = {
        "sender": "colleague@organization-sandbox.com",
        "recipient": "team@organization-sandbox.com",
        "subject": "Project review sync slides discussion",
        "body": "Hi team, please review the slides before our synchronization meeting tomorrow at 2PM. Thanks!",
    }
    response = client.post("/api/v1/scans/text", json=payload)
    assert response.status_code == 200
    assert response.json()["classification"] == "safe"

    # DB count must remain unchanged
    assert db_session.query(Scan).count() == initial_count


def test_create_scan_authenticated(db_session, test_user_a, token_a):
    payload = {
        "sender": "danger@phishing-lookalike.xyz",
        "recipient": "victim@example.com",
        "subject": "URGENT Account limitations update " * 10,  # Ensure truncation happens
        "body": "Your bank account has been locked due to critical issues. Please verify at http://bank-lookalike.xyz immediately.",
    }
    response = client.post("/api/v1/scans/text", json=payload, headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 200

    scan_id = response.json()["scan_id"]
    db_scan = db_session.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
    assert db_scan is not None
    assert db_scan.user_id == test_user_a.id
    assert db_scan.classification == "phishing"
    assert db_scan.sender_domain == "phishing-lookalike.xyz"
    assert len(db_scan.subject_preview) <= 255
    assert db_scan.url_count >= 1


def test_scans_history_pagination(db_session, test_user_a, token_a):
    # Pre-populate scans
    for i in range(15):
        scan = Scan(
            user_id=test_user_a.id,
            classification="safe",
            risk_score=10,
            confidence=0.9,
            legitimate_probability=0.9,
            phishing_probability=0.1,
            model_version="test-model",
            processing_time_ms=50,
            url_count=0,
            indicator_count=0,
            high_severity_count=0,
            sender_domain="safe.com",
            recipient_domain="safe.com",
            subject_preview=f"Subject {i}",
            indicators_json=[],
            urls_json=[],
        )
        db_session.add(scan)
    db_session.commit()

    # Query page 1 with page_size=10
    response = client.get("/api/v1/scans?page=1&page_size=10", headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["page"] == 1
    assert json_data["page_size"] == 10
    assert json_data["total"] == 15
    assert json_data["total_pages"] == 2
    assert len(json_data["items"]) == 10


def test_cross_user_scan_access(db_session, test_user_a, token_a, test_user_b, token_b):
    # User A creates a scan
    scan = Scan(
        user_id=test_user_a.id,
        classification="safe",
        risk_score=10,
        confidence=0.9,
        legitimate_probability=0.9,
        phishing_probability=0.1,
        model_version="test-model",
        processing_time_ms=50,
        url_count=0,
        indicator_count=0,
        high_severity_count=0,
        sender_domain="safe.com",
        recipient_domain="safe.com",
        subject_preview="User A scan subject",
        indicators_json=[],
        urls_json=[],
    )
    db_session.add(scan)
    db_session.commit()
    db_session.refresh(scan)

    # User B queries User A's scan (should be forbidden / not found)
    response = client.get(f"/api/v1/scans/{scan.id}", headers={"Authorization": f"Bearer {token_b}"})
    assert response.status_code == 404

    # User A queries User A's scan (should succeed)
    response_ok = client.get(f"/api/v1/scans/{scan.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert response_ok.status_code == 200


def test_scan_delete_cascade_feedback(db_session, test_user_a, token_a):
    scan = Scan(
        user_id=test_user_a.id,
        classification="safe",
        risk_score=10,
        confidence=0.9,
        legitimate_probability=0.9,
        phishing_probability=0.1,
        model_version="test-model",
        processing_time_ms=50,
        url_count=0,
        indicator_count=0,
        high_severity_count=0,
        sender_domain="safe.com",
        recipient_domain="safe.com",
        subject_preview="Delete cascade test subject",
        indicators_json=[],
        urls_json=[],
    )
    db_session.add(scan)
    db_session.commit()
    db_session.refresh(scan)

    # Submit feedback
    feedback_payload = {"rating": "yes", "comment": "Accurate prediction feedback"}
    fb_resp = client.post(f"/api/v1/scans/{scan.id}/feedback", json=feedback_payload, headers={"Authorization": f"Bearer {token_a}"})
    assert fb_resp.status_code == 200

    # Confirm feedback exists in DB
    feedback_db = db_session.query(Feedback).filter(Feedback.scan_id == scan.id).first()
    assert feedback_db is not None

    # Delete scan
    del_resp = client.delete(f"/api/v1/scans/{scan.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert del_resp.status_code == 200

    # Confirm scan and feedback are deleted
    assert db_session.query(Scan).filter(Scan.id == scan.id).first() is None
    assert db_session.query(Feedback).filter(Feedback.scan_id == scan.id).first() is None


def test_duplicate_feedback_prevention(db_session, test_user_a, token_a):
    scan = Scan(
        user_id=test_user_a.id,
        classification="safe",
        risk_score=10,
        confidence=0.9,
        legitimate_probability=0.9,
        phishing_probability=0.1,
        model_version="test-model",
        processing_time_ms=50,
        url_count=0,
        indicator_count=0,
        high_severity_count=0,
        sender_domain="safe.com",
        recipient_domain="safe.com",
        subject_preview="Duplicate feedback subject",
        indicators_json=[],
        urls_json=[],
    )
    db_session.add(scan)
    db_session.commit()
    db_session.refresh(scan)

    feedback_payload = {"rating": "yes", "comment": "Accurate feedback 1"}
    # Submit first
    fb_resp1 = client.post(f"/api/v1/scans/{scan.id}/feedback", json=feedback_payload, headers={"Authorization": f"Bearer {token_a}"})
    assert fb_resp1.status_code == 200

    # Submit duplicate (must fail with 400)
    fb_resp2 = client.post(f"/api/v1/scans/{scan.id}/feedback", json=feedback_payload, headers={"Authorization": f"Bearer {token_a}"})
    assert fb_resp2.status_code == 400


def test_dashboard_stats_calculations(db_session, test_user_a, token_a):
    # Add 2 safe and 1 phishing scans
    scan1 = Scan(
        user_id=test_user_a.id,
        classification="safe",
        risk_score=10,
        confidence=0.9,
        legitimate_probability=0.9,
        phishing_probability=0.1,
        model_version="test",
        processing_time_ms=50,
        url_count=0,
        indicator_count=0,
        high_severity_count=0,
        sender_domain="a.com",
        recipient_domain="a.com",
        subject_preview="S1",
        indicators_json=[],
        urls_json=[],
    )
    scan2 = Scan(
        user_id=test_user_a.id,
        classification="safe",
        risk_score=20,
        confidence=0.8,
        legitimate_probability=0.8,
        phishing_probability=0.2,
        model_version="test",
        processing_time_ms=50,
        url_count=0,
        indicator_count=0,
        high_severity_count=0,
        sender_domain="a.com",
        recipient_domain="a.com",
        subject_preview="S2",
        indicators_json=[],
        urls_json=[],
    )
    scan3 = Scan(
        user_id=test_user_a.id,
        classification="phishing",
        risk_score=90,
        confidence=0.95,
        legitimate_probability=0.05,
        phishing_probability=0.95,
        model_version="test",
        processing_time_ms=50,
        url_count=0,
        indicator_count=0,
        high_severity_count=0,
        sender_domain="a.com",
        recipient_domain="a.com",
        subject_preview="S3",
        indicators_json=[],
        urls_json=[],
    )
    db_session.add_all([scan1, scan2, scan3])
    db_session.commit()

    response = client.get("/api/v1/dashboard/stats", headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["total_scans"] == 3
    assert json_data["safe_results"] == 2
    assert json_data["phishing_results"] == 1
    assert json_data["average_risk_score"] == 40  # (10 + 20 + 90) / 3 = 40

    # Also test /dashboard/summary alias
    response_summary = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token_a}"})
    assert response_summary.status_code == 200
    assert response_summary.json() == json_data

import json
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.background_job import BackgroundJob
from app.models.user import User
from app.security.jwt import create_access_token

client = TestClient(app)


@pytest.fixture
def user_job_a(db_session):
    user = User(email="job_user_a@example.com", password_hash="hash123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_job_a(user_job_a):
    return create_access_token(subject=str(user_job_a.id), role=user_job_a.role)


@pytest.fixture
def user_job_b(db_session):
    user = User(email="job_user_b@example.com", password_hash="hash123", role="user", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_job_b(user_job_b):
    return create_access_token(subject=str(user_job_b.id), role=user_job_b.role)


def test_create_background_job_model(user_job_a, db_session):
    job = BackgroundJob(
        job_type="gmail_sync",
        user_id=user_job_a.id,
        status="queued",
        attempt_count=0,
        max_attempts=3,
        result_summary=json.dumps({"messages_processed": 5}),
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    assert job.id is not None
    assert job.status == "queued"
    assert "gmail_sync" in str(job)


def test_get_job_status_authenticated(user_job_a, token_job_a, db_session):
    job = BackgroundJob(
        job_type="gmail_sync",
        user_id=user_job_a.id,
        status="completed",
        attempt_count=1,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        result_summary=json.dumps({"messages_found": 3, "messages_processed": 3}),
    )
    db_session.add(job)
    db_session.commit()

    res = client.get(f"/api/v1/jobs/{job.id}", headers={"Authorization": f"Bearer {token_job_a}"})
    assert res.status_code == 200
    data = res.json()
    assert data["job_id"] == str(job.id)
    assert data["status"] == "completed"
    assert data["result_summary"]["messages_processed"] == 3


def test_get_job_status_unauthenticated(user_job_a, db_session):
    job = BackgroundJob(job_type="gmail_sync", user_id=user_job_a.id, status="queued")
    db_session.add(job)
    db_session.commit()

    res = client.get(f"/api/v1/jobs/{job.id}")
    assert res.status_code == 401


def test_get_job_status_cross_user_isolation(user_job_a, user_job_b, token_job_b, db_session):
    # Job belongs to User A
    job = BackgroundJob(job_type="gmail_sync", user_id=user_job_a.id, status="queued")
    db_session.add(job)
    db_session.commit()

    # User B tries to view User A's job -> 404 (isolation enforced)
    res = client.get(f"/api/v1/jobs/{job.id}", headers={"Authorization": f"Bearer {token_job_b}"})
    assert res.status_code == 404


def test_get_job_status_not_found(token_job_a):
    random_id = uuid.uuid4()
    res = client.get(f"/api/v1/jobs/{random_id}", headers={"Authorization": f"Bearer {token_job_a}"})
    assert res.status_code == 404

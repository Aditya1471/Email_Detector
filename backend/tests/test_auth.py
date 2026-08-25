import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User
from app.security.password import verify_password
from app.security.jwt import decode_access_token

client = TestClient(app)

def test_register_user_success(db_session):
    payload = {
        "email": "TEST_register@Phishguard.com",
        "password": "SecretPassword123",
        "confirm_password": "SecretPassword123"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    
    json_data = response.json()
    assert "id" in json_data
    assert json_data["email"] == "test_register@phishguard.com"  # Normalized to lower case
    assert "password" not in json_data
    assert "password_hash" not in json_data

    # Verify db state
    db_user = db_session.query(User).filter(User.email == "test_register@phishguard.com").first()
    assert db_user is not None
    assert db_user.email == "test_register@phishguard.com"
    assert verify_password("SecretPassword123", db_user.password_hash)
    assert db_user.password_hash != "SecretPassword123"  # Must not be plaintext

def test_register_duplicate_email(db_session):
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123",
        "confirm_password": "Password123"
    }
    # Register first
    response1 = client.post("/api/v1/auth/register", json=payload)
    assert response1.status_code == 201

    # Register second time
    response2 = client.post("/api/v1/auth/register", json=payload)
    assert response2.status_code == 400
    assert "already registered" in response2.json()["detail"].lower()

def test_register_invalid_email():
    payload = {
        "email": "not-an-email",
        "password": "Password123",
        "confirm_password": "Password123"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

def test_register_weak_password():
    payload = {
        "email": "weak@example.com",
        "password": "short",
        "confirm_password": "short"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

def test_register_password_mismatch():
    payload = {
        "email": "mismatch@example.com",
        "password": "Password123",
        "confirm_password": "DifferentPassword123"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

def test_login_success(db_session):
    # Register first
    reg_payload = {
        "email": "login@example.com",
        "password": "SecretPassword123",
        "confirm_password": "SecretPassword123"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    # Login via urlencoded form data
    login_data = {
        "username": "login@example.com",
        "password": "SecretPassword123"
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    json_data = response.json()
    assert "access_token" in json_data
    assert json_data["token_type"] == "bearer"
    assert json_data["user"]["email"] == "login@example.com"

    # Decode and verify JWT claims
    token = json_data["access_token"]
    payload = decode_access_token(token)
    assert payload["role"] == "user"
    assert "sub" in payload

def test_login_invalid_password(db_session):
    # Register first
    reg_payload = {
        "email": "wrongpwd@example.com",
        "password": "SecretPassword123",
        "confirm_password": "SecretPassword123"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    # Login with incorrect password
    login_data = {
        "username": "wrongpwd@example.com",
        "password": "WrongPassword123"
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 401
    assert "invalid email or password" in response.json()["detail"].lower()

def test_login_inactive_user(db_session):
    # Register
    reg_payload = {
        "email": "inactive@example.com",
        "password": "SecretPassword123",
        "confirm_password": "SecretPassword123"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    # Make inactive in DB
    user = db_session.query(User).filter(User.email == "inactive@example.com").first()
    user.is_active = False
    db_session.commit()

    # Login
    login_data = {
        "username": "inactive@example.com",
        "password": "SecretPassword123"
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 401
    assert "inactive" in response.json()["detail"].lower()

def test_me_endpoint_success(db_session):
    # Register and login to get token
    reg_payload = {
        "email": "me@example.com",
        "password": "SecretPassword123",
        "confirm_password": "SecretPassword123"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_data = {
        "username": "me@example.com",
        "password": "SecretPassword123"
    }
    login_resp = client.post("/api/v1/auth/login", data=login_data)
    token = login_resp.json()["access_token"]

    # Query /me
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"
    assert "password_hash" not in response.json()

def test_me_endpoint_missing_token():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

def test_me_endpoint_invalid_token():
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalidtokenhere"})
    assert response.status_code == 401

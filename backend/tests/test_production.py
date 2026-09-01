import pytest
from fastapi.testclient import TestClient

from app.config import Settings, settings
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_production_settings_validation_jwt():
    # Verify that a default JWT secret is rejected in production
    s = Settings(
        APP_ENV="production",
        JWT_SECRET_KEY="replace-with-a-long-random-development-secret",
        TOKEN_ENCRYPTION_KEY="custom-encryption-key-32bytes-123456789=",
        ALLOWED_CORS_ORIGINS=["http://localhost:5500"],
        ALLOWED_HOSTS_STR="localhost,127.0.0.1",
    )
    with pytest.raises(ValueError, match="Insecure JWT_SECRET_KEY"):
        s.validate_production_settings()


def test_production_settings_validation_token_key():
    # Verify default token encryption key is rejected in production
    s = Settings(
        APP_ENV="production",
        JWT_SECRET_KEY="some-secure-production-secret-12345",
        TOKEN_ENCRYPTION_KEY="qO9LSTDQJdKmym0dqxcC42v1VlZUXQhBTWJ6sfIewUw=",
        ALLOWED_CORS_ORIGINS=["http://localhost:5500"],
        ALLOWED_HOSTS_STR="localhost,127.0.0.1",
    )
    with pytest.raises(ValueError, match="Insecure default TOKEN_ENCRYPTION_KEY"):
        s.validate_production_settings()


def test_production_settings_validation_cors():
    # Verify wildcard CORS is rejected in production
    s = Settings(
        APP_ENV="production",
        JWT_SECRET_KEY="some-secure-production-secret-12345",
        TOKEN_ENCRYPTION_KEY="custom-encryption-key-32bytes-123456789=",
        ALLOWED_CORS_ORIGINS=["*"],
        ALLOWED_HOSTS_STR="localhost,127.0.0.1",
    )
    with pytest.raises(ValueError, match="Wildcard CORS origins are forbidden"):
        s.validate_production_settings()


def test_production_settings_validation_hosts():
    # Verify empty ALLOWED_HOSTS is rejected in production
    s = Settings(
        APP_ENV="production",
        JWT_SECRET_KEY="some-secure-production-secret-12345",
        TOKEN_ENCRYPTION_KEY="custom-encryption-key-32bytes-123456789=",
        ALLOWED_CORS_ORIGINS=["http://localhost:5500"],
        ALLOWED_HOSTS_STR="",
    )
    with pytest.raises(ValueError, match="ALLOWED_HOSTS must not be empty"):
        s.validate_production_settings()


def test_trusted_host_middleware_success():
    # Configured allowed hosts includes localhost and 127.0.0.1
    response = client.get("/health", headers={"Host": "localhost"})
    assert response.status_code == 200


def test_trusted_host_middleware_failure():
    # Arbitrary host headers should be rejected
    response = client.get("/health", headers={"Host": "untrusted-attacker.com"})
    assert response.status_code == 400


def test_security_headers_present():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "x-request-id" in response.headers


def test_request_size_limit_under():
    payload = {"sender": "a@b.com", "recipient": "b@c.com", "subject": "test", "body": "hello"}
    response = client.post("/api/v1/scans", json=payload)
    assert response.status_code == 200


def test_request_size_limit_over():
    # Create large payload that exceeds settings max request size
    large_body = "x" * (settings.MAX_REQUEST_BODY_BYTES + 100)
    payload = {"sender": "a@b.com", "recipient": "b@c.com", "subject": "test", "body": large_body}
    response = client.post("/api/v1/scans", json=payload)
    assert response.status_code == 413
    assert response.json()["detail"] == "Request body exceeds the maximum allowed size."


def test_rate_limiting_triggered():
    # Enable rate limiter for this specific test case
    settings.RATE_LIMIT_ENABLED = True
    try:
        # Trigger logins rapidly to exceed category threshold (limit 5/minute)
        payload = {"username": "user@example.com", "password": "Password123!"}

        # We execute 6 logins; the 6th must return 429
        responses = []
        for _ in range(6):
            resp = client.post("/api/v1/auth/login", data=payload, headers={"X-Forwarded-For": "192.168.1.50"})
            responses.append(resp)

        # Clean rates for future test isolation
        from app.security.rate_limiter import limiter

        limiter.requests.clear()

        # Verify at least one return code is 429
        status_codes = [r.status_code for r in responses]
        assert 429 in status_codes

        # Find the rate-limited response and check headers
        limited_resp = next(r for r in responses if r.status_code == 429)
        assert "retry-after" in limited_resp.headers
    finally:
        # Re-disable rate limits for test suite runs stability
        settings.RATE_LIMIT_ENABLED = False


def test_global_exception_handler_masking():
    # Force route trigger returning unexpected runtime exception
    # (By passing invalid inputs or accessing a mock endpoint that raises)
    # Let's mock a router call that raises a database or file path error
    @app.get("/test-unhandled-exception")
    def trigger_error():
        raise FileNotFoundError("/usr/local/secret/db.sqlite")

    response = client.get("/test-unhandled-exception")
    assert response.status_code == 500
    json_data = response.json()
    assert json_data["detail"] == "An unexpected server error occurred."
    assert "request_id" in json_data
    # Mask check
    assert "secret" not in json_data["detail"]
    assert "db.sqlite" not in json_data["detail"]


def test_hsts_middleware_injection():
    # HSTS disabled by default
    settings.ENABLE_HSTS = False
    response = client.get("/health")
    assert "strict-transport-security" not in response.headers

    # HSTS enabled but HTTP scheme
    settings.ENABLE_HSTS = True
    response = client.get("/health")
    assert "strict-transport-security" not in response.headers

    # HSTS enabled and X-Forwarded-Proto https
    response = client.get("/health", headers={"x-forwarded-proto": "https"})
    assert response.headers["strict-transport-security"] == f"max-age={settings.HSTS_MAX_AGE}"

    # Reset settings properties
    settings.ENABLE_HSTS = False

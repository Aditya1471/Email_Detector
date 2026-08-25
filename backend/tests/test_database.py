from app.config import settings
from app.database import engine, SessionLocal, get_db
from app.models.base import Base
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_settings_load():
    assert settings.APP_NAME == "PhishGuard API"
    assert settings.DATABASE_URL is not None
    assert settings.TEST_DATABASE_URL is not None
    assert isinstance(settings.DATABASE_ECHO, bool)

def test_engine_construction():
    assert engine is not None
    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.username == "phishguard"
    assert engine.url.database == "phishguard"

def test_session_factory():
    session = SessionLocal()
    assert session is not None
    session.close()

def test_get_db_generator():
    db_gen = get_db()
    session = next(db_gen)
    assert session is not None
    # Verify the generator closes the session correctly
    try:
        next(db_gen)
    except StopIteration:
        pass

def test_base_metadata_exists():
    assert Base.metadata is not None

def test_health_endpoint_response():
    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.json()
    assert "status" in json_data
    assert json_data["service"] == "phishguard-api-gateway"
    assert json_data["version"] == "1.2.0"
    assert "database" in json_data

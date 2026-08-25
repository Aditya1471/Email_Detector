import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models.base import Base

settings.RATE_LIMIT_ENABLED = False
from app.database import get_db
from app.main import app

# Use isolated SQLite database URL for local test verification
TEST_DB_URL = settings.TEST_DATABASE_URL

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False} if "sqlite" in TEST_DB_URL else {}
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine
)

@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    """
    Initializes base table definitions in the isolated test database.
    """
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="function")
def db_session():
    """
    Yields an isolated transaction session for unit test checkpoints.
    Rolls back any changes made during the test.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function", autouse=True)
def override_db_dependency(db_session):
    """
    Overrides the FastAPI dependency get_db to return the isolated test session.
    """
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override
    yield
    app.dependency_overrides.pop(get_db, None)

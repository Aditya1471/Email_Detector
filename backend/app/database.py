from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from .config import settings

# Construct the SQLAlchemy database engine with pool pre-ping connection tests enabled.
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True
)

# Setup a transactional session factory
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding request-scoped database sessions.
    Guarantees session closure and cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

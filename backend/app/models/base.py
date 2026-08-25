from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.x Declarative Base class.
    Provides a shared metadata container for all models and Alembic.
    """

    pass

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from src.app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def create_database_engine(settings):
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout,
        future=True,
    )


engine = create_database_engine(settings)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def import_models() -> None:
    from src.consolidation import models as consolidation_models  # noqa: F401
    from src.messaging import models as messaging_models  # noqa: F401
    from src.transactions import models as transaction_models  # noqa: F401


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

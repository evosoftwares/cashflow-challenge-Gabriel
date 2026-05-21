from src.app.config import Settings
from src.database.connection import create_database_engine


def test_create_database_engine_applies_configured_pool_limits():
    settings = Settings(
        database_url="postgresql+psycopg://cashflow:cashflow@postgres:5432/cashflow",
        database_pool_size=25,
        database_max_overflow=35,
        database_pool_timeout=12,
    )

    engine = create_database_engine(settings)

    assert engine.pool.size() == 25
    assert engine.pool._max_overflow == 35
    assert engine.pool.timeout() == 12

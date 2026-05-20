from pathlib import Path
import re


def test_alembic_configuration_is_versioned():
    assert Path("alembic.ini").is_file()
    assert Path("src/database/alembic/env.py").is_file()

    versions = list(Path("src/database/alembic/versions").glob("*.py"))
    assert len(versions) == 1
    migration = versions[0].read_text()
    assert re.search(r"op\.create_table\(\s*'transactions'", migration)
    assert re.search(r"op\.create_table\(\s*'daily_balances'", migration)
    assert re.search(r"op\.create_table\(\s*'processed_events'", migration)

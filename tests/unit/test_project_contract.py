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
    assert re.search(r"op\.create_table\(\s*'outbox_events'", migration)
    assert "ix_daily_balances_merchant_date" not in migration
    assert "ix_transactions_merchant_id" not in migration
    assert "ForeignKeyConstraint(['transaction_id'], ['transactions.id']" in migration


def test_sql_manual_migration_matches_alembic_contract():
    sql = Path("src/database/migrations/001_initial_schema.sql").read_text()

    assert "CREATE TABLE outbox_events" in sql
    assert "FOREIGN KEY (transaction_id) REFERENCES transactions(id)" in sql
    assert "CREATE INDEX ix_transactions_merchant_occurred_at" in sql
    assert "CREATE INDEX ix_daily_balances_merchant_date" not in sql
    assert "CREATE INDEX ix_transactions_merchant_id" not in sql


def test_runtime_schema_is_owned_by_alembic_only():
    production_files = [
        Path("src/app/main.py"),
        Path("src/consolidation/worker.py"),
        Path("src/database/connection.py"),
    ]

    for file_path in production_files:
        source = file_path.read_text()
        assert "init_db" not in source
        assert "create_all" not in source


def test_compliance_and_docker_e2e_artifacts_are_versioned():
    compliance = Path("docs/compliance-checklist.md")
    scalability = Path("docs/scalability.md")
    docker_e2e = Path("tests/integration/docker_e2e.sh")
    overload_docs = Path("docs/overload-tests.md")

    assert compliance.is_file()
    assert scalability.is_file()
    assert docker_e2e.is_file()
    assert overload_docs.is_file()

    compliance_text = compliance.read_text()
    assert "Requisito do avaliador" in compliance_text
    assert "Evidencia no repositorio" in compliance_text
    assert "Supabase" in compliance_text
    assert "Escalabilidade" in compliance_text

    scalability_text = scalability.read_text()
    assert "upsert atômico" in scalability_text
    assert "ON CONFLICT" in scalability_text
    assert "Outbox Pattern" in scalability_text
    assert "Dead Letter Queue" in scalability_text
    assert "daily_balances" in scalability_text

    docker_e2e_text = docker_e2e.read_text()
    assert "docker compose stop worker" in docker_e2e_text
    assert "docker compose start worker" in docker_e2e_text
    assert "rabbitmqctl list_queues" in docker_e2e_text
    assert "daily-balances" in docker_e2e_text

    compose_text = Path("docker-compose.yml").read_text()
    assert "outbox-dispatcher" in compose_text
    assert "python -m src.messaging.outbox_dispatcher" in compose_text

    overload_text = overload_docs.read_text()
    assert "Overload de leitura" in overload_text
    assert "worker parado" in overload_text
    assert "transaction.created 500 0" in overload_text

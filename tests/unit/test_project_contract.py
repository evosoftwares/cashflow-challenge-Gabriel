from pathlib import Path
import re


def test_alembic_configuration_is_versioned():
    assert Path("alembic.ini").is_file()
    assert Path("src/database/alembic/env.py").is_file()

    versions = sorted(Path("src/database/alembic/versions").glob("*.py"))
    assert len(versions) == 2
    migration = versions[0].read_text()
    full_migration_contract = "\n".join(version.read_text() for version in versions)
    assert re.search(r"op\.create_table\(\s*'transactions'", migration)
    assert re.search(r"op\.create_table\(\s*'daily_balances'", migration)
    assert re.search(r"op\.create_table\(\s*'processed_events'", migration)
    assert re.search(r"op\.create_table\(\s*'outbox_events'", migration)
    assert "ix_daily_balances_merchant_date" not in migration
    assert "ix_transactions_merchant_id" not in migration
    assert "ForeignKeyConstraint(['transaction_id'], ['transactions.id']" in migration
    assert "client_request_id" in full_migration_contract
    assert "uq_transactions_client_request_id" in full_migration_contract


def test_sql_manual_migration_matches_alembic_contract():
    sql = Path("src/database/migrations/001_initial_schema.sql").read_text()

    assert "CREATE TABLE outbox_events" in sql
    assert "client_request_id UUID UNIQUE" in sql
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
    frontend_package = Path("frontend/package.json")
    frontend_app = Path("frontend/src/App.tsx")
    offline_queue = Path("frontend/src/offlineQueue.ts")

    assert compliance.is_file()
    assert scalability.is_file()
    assert docker_e2e.is_file()
    assert overload_docs.is_file()
    assert frontend_package.is_file()
    assert frontend_app.is_file()
    assert offline_queue.is_file()

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
    assert "Interface operacional para demonstracao" in compliance_text
    readme_text = Path("README.md").read_text()
    assert "Portal operacional" in readme_text
    assert "IndexedDB" in readme_text


def test_overload_worker_script_restarts_worker_on_failure():
    script = Path("tests/load/overload_worker_backlog.sh").read_text()

    assert "cleanup()" in script
    assert "trap cleanup EXIT" in script
    assert "docker compose start worker" in script
    assert '"statuses": {str(status): count for status, count in Counter(results).items()}' in script
    assert "dict(Counter(results))" not in script


def test_docker_compose_sets_database_pool_for_write_overload():
    compose_text = Path("docker-compose.yml").read_text()

    assert "DATABASE_POOL_SIZE: 25" in compose_text
    assert "DATABASE_MAX_OVERFLOW: 35" in compose_text
    assert "DATABASE_POOL_TIMEOUT: 12" in compose_text


def test_final_delivery_artifacts_are_production_ready():
    verification = Path("docs/verification.md").read_text()
    scalability = Path("docs/scalability.md").read_text()
    production_readiness = Path("docs/production-readiness.md")
    workflow = Path(".github/workflows/ci.yml")
    dockerignore = Path(".dockerignore")

    assert production_readiness.is_file()
    assert "Prontidao de Producao" in production_readiness.read_text()
    assert workflow.is_file()
    assert "pytest" in workflow.read_text()
    assert "npm --prefix frontend test" in workflow.read_text()
    assert dockerignore.is_file()
    assert ".venv/" in dockerignore.read_text()
    assert "frontend/node_modules/" in dockerignore.read_text()
    assert "17 passed" in verification
    assert "8 passed" not in verification
    assert "client_request_id" in verification
    assert "foi implementada como uma operação atômica" in scalability
    assert "deve evoluir para uma operação atômica" not in scalability

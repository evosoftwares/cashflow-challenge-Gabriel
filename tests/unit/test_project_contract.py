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

    assert compliance.is_file()
    assert scalability.is_file()
    assert docker_e2e.is_file()

    compliance_text = compliance.read_text()
    assert "Requisito do avaliador" in compliance_text
    assert "Evidencia no repositorio" in compliance_text
    assert "Supabase" in compliance_text
    assert "Escalabilidade" in compliance_text

    scalability_text = scalability.read_text()
    assert "Outbox Pattern" in scalability_text
    assert "Dead Letter Queue" in scalability_text
    assert "daily_balances" in scalability_text

    docker_e2e_text = docker_e2e.read_text()
    assert "docker compose stop worker" in docker_e2e_text
    assert "docker compose start worker" in docker_e2e_text
    assert "rabbitmqctl list_queues" in docker_e2e_text
    assert "daily-balances" in docker_e2e_text

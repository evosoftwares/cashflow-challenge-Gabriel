from src.app.observability import build_log_payload


def test_log_payload_has_metric_contract():
    payload = build_log_payload(
        event="transaction_created",
        component="transactions",
        metric_name="cashflow_transactions_created_total",
        metric_value=1,
        metric_labels={"type": "CREDIT"},
        transaction_id="4dc7300e-8df7-4634-b6a0-8bda7afc4218",
    )

    assert payload["log_schema_version"] == "1.0"
    assert payload["event"] == "transaction_created"
    assert payload["component"] == "transactions"
    assert payload["metric"] == {
        "name": "cashflow_transactions_created_total",
        "value": 1,
        "labels": {"type": "CREDIT"},
    }
    assert payload["transaction_id"] == "4dc7300e-8df7-4634-b6a0-8bda7afc4218"
    assert payload["timestamp"].endswith("Z")

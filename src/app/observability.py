import json
import logging
from collections import defaultdict
from datetime import UTC, datetime
from threading import Lock
from typing import Any

LOG_SCHEMA_VERSION = "1.0"


class MetricsRegistry:
    def __init__(self) -> None:
        self._counters: defaultdict[tuple[str, tuple[tuple[str, str], ...]], float] = defaultdict(float)
        self._lock = Lock()

    def increment_counter(self, name: str, labels: dict[str, str] | None = None, value: float = 1) -> None:
        label_items = tuple(sorted((labels or {}).items()))
        with self._lock:
            self._counters[(name, label_items)] += value

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()

    def render_prometheus(self) -> str:
        with self._lock:
            counters = sorted(self._counters.items())

        lines = [
            "# HELP cashflow_metrics Process-local cashflow counters.",
            "# TYPE cashflow_metrics counter",
        ]
        for (name, label_items), value in counters:
            labels = _format_labels(dict(label_items))
            lines.append(f"{name}{labels} {_format_value(value)}")
        return "\n".join(lines) + "\n"


metrics_registry = MetricsRegistry()


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")


def build_log_payload(
    *,
    event: str,
    component: str,
    metric_name: str | None = None,
    metric_value: float | int | None = None,
    metric_labels: dict[str, str] | None = None,
    **fields: Any,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "timestamp": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "log_schema_version": LOG_SCHEMA_VERSION,
        "event": event,
        "component": component,
    }
    if metric_name is not None:
        payload["metric"] = {
            "name": metric_name,
            "value": metric_value if metric_value is not None else 1,
            "labels": metric_labels or {},
        }
    payload.update(fields)
    return payload


def log_event(logger: logging.Logger, *, event: str, component: str, level: int = logging.INFO, **fields: Any) -> None:
    logger.log(
        level,
        json.dumps(
            build_log_payload(event=event, component=component, **fields),
            ensure_ascii=False,
            sort_keys=True,
        ),
    )


def record_counter(
    logger: logging.Logger,
    *,
    event: str,
    component: str,
    metric_name: str,
    metric_labels: dict[str, str] | None = None,
    metric_value: float | int = 1,
    level: int = logging.INFO,
    **fields: Any,
) -> None:
    metrics_registry.increment_counter(metric_name, metric_labels, float(metric_value))
    log_event(
        logger,
        event=event,
        component=component,
        level=level,
        metric_name=metric_name,
        metric_value=metric_value,
        metric_labels=metric_labels or {},
        **fields,
    )


def _format_labels(labels: dict[str, str]) -> str:
    if not labels:
        return ""
    values = ",".join(f'{key}="{_escape_label(value)}"' for key, value in sorted(labels.items()))
    return f"{{{values}}}"


def _escape_label(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def _format_value(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return f"{value:.6f}".rstrip("0").rstrip(".")

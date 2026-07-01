---
type: Coding Standard
title: "Observability — structlog + OpenTelemetry via the ADOT Collector (python)"
description: OTel Python SDK exporting OTLP/gRPC to the ADOT Collector, business spans carrying Weave-required attributes, and structlog lines correlated by trace_id/span_id.
tags: [standards, patterns, observability, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/observability/otel-adot-python.md
topic: observability
stack: python
verification: "py_compile OK; ruff check clean (unresolved opentelemetry/structlog imports expected, not flagged)"
---

# Observability — structlog + OpenTelemetry via the ADOT Collector (python)

Wire the OTel Python SDK to export OTLP/gRPC to the **ADOT Collector** (the only egress path to
CloudWatch), open a low-cardinality **business span** for the operation, stamp it with the
Weave-required attributes (`weave.tenant_id`, `weave.user_id`, `weave.engine`, `weave.request_id`),
and bind those plus `trace_id`/`span_id` onto every structlog line so logs join their trace.

```python
# app/observability.py
from typing import Any

import structlog
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

_ENGINE = "constitution"  # platform | constitution | build | events | explorer
_resource = Resource.create({"service.name": "weave-constitution", "weave.engine": _ENGINE})


def init_tracing(collector_endpoint: str) -> None:
    """Export OTLP/gRPC to the ADOT Collector — never write to CloudWatch directly."""
    provider = TracerProvider(resource=_resource)
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=collector_endpoint))
    )
    trace.set_tracer_provider(provider)


tracer = trace.get_tracer("weave.constitution")

# Defense-in-depth: mask known-sensitive keys before render (symmetry with the Node pino redact
# list). Discipline keeps secrets/PII out of log fields; this processor is the belt-and-braces.
_REDACT_KEYS = frozenset({"authorization", "password", "token", "secret", "api_key", "cookie"})


def _redact_sensitive(
    _logger: object, _method: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    for key in event_dict:
        if key.lower() in _REDACT_KEYS:
            event_dict[key] = "***"
    return event_dict


structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,  # pull in bound trace/tenant/request fields
        _redact_sensitive,  # drop/mask sensitive keys before they reach the JSON sink
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)

log = structlog.get_logger()


def _bind_log_context(*, tenant_id: str, user_id: str, request_id: str) -> None:
    """Bind trace ids + Weave-required fields so every JSON log line correlates to its span."""
    ctx = trace.get_current_span().get_span_context()
    structlog.contextvars.bind_contextvars(
        trace_id=format(ctx.trace_id, "032x"),
        span_id=format(ctx.span_id, "016x"),
        **{
            "weave.tenant_id": tenant_id,
            "weave.user_id": user_id,
            "weave.request_id": request_id,
            "weave.engine": _ENGINE,
        },
    )


async def render_widget(tenant_id: str, user_id: str, request_id: str) -> None:
    # Business span (low-cardinality name); the latency SLO attaches here, not the raw HTTP span.
    with tracer.start_as_current_span("weave.constitution.render_widget") as span:
        span.set_attribute("weave.tenant_id", tenant_id)  # required on every server span
        span.set_attribute("weave.user_id", user_id)
        span.set_attribute("weave.engine", _ENGINE)
        span.set_attribute("weave.request_id", request_id)
        _bind_log_context(tenant_id=tenant_id, user_id=user_id, request_id=request_id)
        log.info("widget.render.start")  # -> structured JSON with trace_id + span_id
```

**Why:** the SDK batches spans and ships OTLP/gRPC to the ADOT Collector, which fans out to X-Ray
(traces) and EMF (metrics) — services never call CloudWatch APIs, so the pipeline is swappable and the
IAM surface stays small. Naming the span `weave.constitution.render_widget` (a template, never a
resolved URL/IRI) keeps cardinality low so aggregation and cost stay bounded, and gives the latency
SLO a stable business span to measure. Binding `trace_id`/`span_id` into structlog lets an SRE pivot
from any log line straight into the trace.
**Security:** never set secrets, tokens, raw credentials, PII, or SQL-with-user-input as span
attributes or log fields — attribute values are sampled into traces and retained like logs. Keep IDs
and query text in attributes, out of span names. The `_redact_sensitive` structlog processor is the
belt-and-braces backstop (mirroring the Node pino `redact` list): it masks known-sensitive keys
(`authorization`, `password`, `token`, `secret`, …) before any line reaches the JSON sink.
**Anti-patterns:** interpolating IDs/IRIs into the span name (cardinality explosion); writing to
CloudWatch directly instead of through ADOT; using `SimpleSpanProcessor` in production (synchronous,
blocks the request path — use `BatchSpanProcessor`); logging a plain string without the bound
trace/tenant context, so the line can't be correlated.

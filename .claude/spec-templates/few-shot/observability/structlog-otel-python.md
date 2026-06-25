---
topic: observability
stack: python
references:
  - docs/stack-equivalents.md
---

# structlog + OpenTelemetry Python — FastAPI + SQLAlchemy auto-instrumentation

structlog 24+, opentelemetry-sdk 1.25+, auto-instrumentation for FastAPI and
SQLAlchemy. Trace/span IDs are bound into every log event via a processor.

```python
# app/telemetry.py  — call configure_telemetry() before app startup
import os
import logging
import structlog
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor


def _inject_trace_info(logger, method, event_dict):  # noqa: ARG001
    """structlog processor: inject traceId + spanId into every event."""
    span = trace.get_current_span()
    ctx  = span.get_span_context()
    if ctx.is_valid:
        event_dict["traceId"]  = format(ctx.trace_id, "032x")
        event_dict["spanId"]   = format(ctx.span_id,  "016x")
        event_dict["sampled"]  = str(ctx.trace_flags & 0x01 == 1)
    return event_dict


def configure_telemetry(app=None, engine=None) -> None:
    """Initialise OTel + structlog. Call once at app startup."""
    _setup_otel()
    _setup_structlog()
    if app:
        FastAPIInstrumentor.instrument_app(app)
    if engine:
        SQLAlchemyInstrumentor().instrument(engine=engine)


def _setup_otel() -> None:
    provider = TracerProvider()
    provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(
                endpoint=os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
            )
        )
    )
    trace.set_tracer_provider(provider)


def _setup_structlog() -> None:
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,          # bound context vars
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        _inject_trace_info,                               # OTel correlation
        structlog.processors.StackInfoRenderer(),
    ]

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)
```

```python
# app/main.py
from fastapi import FastAPI
from app.telemetry import configure_telemetry
from app.db import engine

app = FastAPI()
configure_telemetry(app=app, engine=engine)
```

```python
# Usage anywhere in the app
import structlog

log = structlog.get_logger(__name__)

async def create_order(payload):
    # Bind request-scoped values — available in all downstream log events
    structlog.contextvars.bind_contextvars(customer_id=payload.customer_id)
    log.info("creating_order", item_count=len(payload.items))
    # ...
    log.info("order_created", order_id="ord-123")
```

```bash
# Environment
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=order-service
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=prod
```

**Why:** `contextvars.bind_contextvars` + `merge_contextvars` processor means
you bind `customer_id` once at request entry and it appears in every downstream
log event — no need to thread it through function arguments.

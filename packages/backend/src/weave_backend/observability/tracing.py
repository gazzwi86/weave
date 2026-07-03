"""OTel wiring (AC-5). ``setup_tracing`` is called once at app startup; tests
call it with ``testing=True`` to get an in-memory exporter back (Law F — no
collector needed to assert span attributes).
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Span

from weave_backend.observability.context import (
    ENGINE_NAME,
    principal_iri_var,
    tenant_id_var,
)

DEFAULT_OTLP_ENDPOINT = "localhost:4317"

# OTel's global TracerProvider can only be set once per process (a second
# `set_tracer_provider` call is a silent no-op with a warning), and
# instrumenting the same FastAPI app twice is similarly a no-op. Tests call
# `setup_tracing` per test function, so we cache the first test exporter and
# hand back the same one rather than pretending each call rewires anything.
_test_exporter: InMemorySpanExporter | None = None


def add_tenant_attributes(span: Span) -> None:
    """Stamps tenant_id/engine/principal_iri onto a span from the current
    ContextVar values. Called directly (not as a FastAPIInstrumentor
    ``server_request_hook``, which fires before any request-scoped code has
    run) by ``TenantContextMiddleware`` (pre-request defaults) and by
    ``auth.dependencies.get_current_principal`` (real, verified values, once
    known) -- both while the span is still guaranteed open. A missing
    tenant_id is a real bug (the context middleware always sets a default) —
    surfaced loudly in test mode rather than silently degraded, so a
    regression fails CI instead of prod.
    """
    tenant_id = tenant_id_var.get()
    if tenant_id is None:
        if os.environ.get("WEAVE_TESTING") == "1":
            raise RuntimeError("span missing required tenant_id attribute")
        tenant_id = "unknown"
    span.set_attribute("tenant_id", tenant_id)
    span.set_attribute("engine", ENGINE_NAME)
    span.set_attribute("principal_iri", principal_iri_var.get() or "urn:weave:anonymous")


def setup_tracing(app: FastAPI, *, testing: bool = False) -> InMemorySpanExporter | None:
    """Wire OTel into `app`. In test mode, returns the in-memory exporter so
    tests can assert on finished spans; in real runs, exports via OTLP/gRPC
    to `OTEL_EXPORTER_OTLP_ENDPOINT` (default localhost:4317) — point it at a
    collector; none ships in docker-compose yet.
    """
    global _test_exporter
    if testing and _test_exporter is not None:
        return _test_exporter

    provider = TracerProvider()
    memory_exporter: InMemorySpanExporter | None = None
    if testing:
        memory_exporter = InMemorySpanExporter()
        _test_exporter = memory_exporter
        provider.add_span_processor(SimpleSpanProcessor(memory_exporter))
    else:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )

        endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", DEFAULT_OTLP_ENDPOINT)
        otlp_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    # Starlette caches its compiled middleware stack on first request and
    # only rebuilds it if this is None. If anything sent a request through
    # `app` before instrumentation ran (e.g. an earlier, unrelated test),
    # that cache would silently keep serving the un-instrumented stack.
    app.middleware_stack = None
    return memory_exporter

"""AC-7 PII hygiene: OTel span attributes carry `prompt_hash`, never raw
prompt text (PRD §2.2). Exercises the pure span-stamping helper directly --
no live FastAPI request needed (Law F).
"""

from __future__ import annotations

import hashlib

from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from weave_backend.dashboard.generate import GenerationSpanAttrs, stamp_generation_span


def test_prompt_hash_not_prompt_in_spans() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer(__name__)

    prompt = "show me active compliance contraventions by domain"
    with tracer.start_as_current_span("dashboard.widget.generate"):
        stamp_generation_span(
            GenerationSpanAttrs(
                prompt=prompt,
                component_type="bar_chart",
                data_source_contract="CE-METRICS-1",
                token_count=412,
                latency_ms=850.0,
                tenant_id="acme-corp",
            )
        )

    spans = exporter.get_finished_spans()
    attrs = spans[-1].attributes or {}
    assert attrs.get("prompt_hash") == hashlib.sha256(prompt.encode()).hexdigest()
    assert prompt not in str(attrs.values())
    assert attrs.get("component_type") == "bar_chart"
    assert attrs.get("data_source_contract") == "CE-METRICS-1"
    assert attrs.get("token_count") == 412
    assert attrs.get("latency_ms") == 850.0
    assert attrs.get("tenant_id") == "acme-corp"

"""AC-2: every SSE payload type round-trips through its Pydantic model
(m2-delta.md §3 event grammar) -- and the closed 9-component set rejects an
unknown `component_type` (m2-delta.md §2).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from weave_backend.schemas.dashboard import (
    SseDataPayload,
    SseDonePayload,
    SseErrorPayload,
    WidgetSpec,
)


def test_widget_spec_schema_rejects_unknown_component() -> None:
    with pytest.raises(ValidationError):
        WidgetSpec(
            component_type="gauge",  # type: ignore[arg-type]
            title="Not a real component",
            data_source_contracts=["CE-METRICS-1"],
            bindings={"field": "x"},
            column_span=2,
        )


def test_sse_event_serialisation() -> None:
    spec = WidgetSpec(
        component_type="bar_chart",
        title="SHACL contraventions by domain",
        data_source_contracts=["CE-METRICS-1"],
        bindings={"field": "shacl_errors_by_severity"},
        column_span=2,
    )
    assert WidgetSpec.model_validate_json(spec.model_dump_json()) == spec

    data = SseDataPayload(rows=[{"severity": "violation", "count": 3}], partial=False)
    assert SseDataPayload.model_validate_json(data.model_dump_json()) == data

    done = SseDonePayload(token_count=412, widget_id="00000000-0000-0000-0000-000000000000")
    assert SseDonePayload.model_validate_json(done.model_dump_json()) == done

    error = SseErrorPayload(state="budget_cap", reason="Monthly AI budget cap reached.")
    assert SseErrorPayload.model_validate_json(error.model_dump_json()) == error


def test_sse_error_state_is_closed_set() -> None:
    with pytest.raises(ValidationError):
        SseErrorPayload(state="not_a_real_state", reason="x")  # type: ignore[arg-type]

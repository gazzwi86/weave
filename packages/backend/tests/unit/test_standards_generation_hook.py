"""TASK-001 (build-engine EPIC-002) unit tests: the E8-S1 generation-context
hook -- AC-4 (empty catalogue degrades to demo-default + warning), AC-5
(stack selection driven off `stack_pins`), and the implementation hint's
`StandardsConflictError` per-axis fallback. Pure functions -- no DB, no HTTP,
no generation service wiring.
"""

from __future__ import annotations

from datetime import UTC, datetime

from weave_backend.standards.generation_hook import (
    StandardsConflictError,
    build_context_addendum,
    resolve_stack_pins,
)
from weave_backend.standards.models import StandardRecord


def _record(*, standard_key: str, stack_pins: dict[str, str] | None = None) -> StandardRecord:
    return StandardRecord(
        standard_id=f"id-{standard_key}",
        tenant_id="t1",
        scope="company",
        project_id=None,
        standard_key=standard_key,
        title=standard_key,
        body_md=f"# {standard_key}\nstandard body",
        stack_pins=stack_pins,
        policy_iri="urn:weave:policy:t1:p1",
        status="active",
        created_by="urn:weave:principal:user:u1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def test_build_context_addendum_degrades_to_demo_default_with_warning_when_empty() -> None:
    addendum = build_context_addendum([])

    assert addendum.standards_missing is True
    assert addendum.standards_section is None
    assert addendum.stack_pins is None
    assert addendum.conflicts == ()


def test_build_context_addendum_drives_stack_selection_from_stack_pins() -> None:
    standards = [
        _record(standard_key="frontend-stack", stack_pins={"frontend": "next.js"}),
        _record(standard_key="backend-stack", stack_pins={"backend": "fastapi"}),
        _record(standard_key="no-pins"),
    ]

    addendum = build_context_addendum(standards)

    assert addendum.standards_missing is False
    assert addendum.stack_pins == {"frontend": "next.js", "backend": "fastapi"}
    assert addendum.conflicts == ()
    assert addendum.standards_section is not None


def test_resolve_stack_pins_conflict_falls_back_to_demo_default_for_that_axis() -> None:
    """Two docs pin different values for the same axis (`frontend`) -- last
    -by-sorted-key-wins is explicitly rejected by the brief's implementation
    hint. That axis drops out of the resolved pins and is reported as a
    named `StandardsConflictError`; a non-conflicting axis (`backend`)
    still resolves normally.
    """
    standards = [
        _record(standard_key="a-frontend", stack_pins={"frontend": "next.js"}),
        _record(standard_key="b-frontend", stack_pins={"frontend": "remix"}),
        _record(standard_key="c-backend", stack_pins={"backend": "fastapi"}),
    ]

    resolution = resolve_stack_pins(standards)

    assert resolution.pins == {"backend": "fastapi"}
    assert len(resolution.conflicts) == 1
    conflict = resolution.conflicts[0]
    assert isinstance(conflict, StandardsConflictError)
    assert conflict.axis == "frontend"
    assert conflict.values == ("next.js", "remix")


def test_build_context_addendum_reports_conflicts_without_halting() -> None:
    standards = [
        _record(standard_key="a-frontend", stack_pins={"frontend": "next.js"}),
        _record(standard_key="b-frontend", stack_pins={"frontend": "remix"}),
    ]

    addendum = build_context_addendum(standards)

    assert addendum.standards_missing is False
    assert addendum.stack_pins is None  # only axis present was the conflicting one
    assert len(addendum.conflicts) == 1

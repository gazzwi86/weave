"""TASK-001 (build-engine EPIC-002) unit tests: `effective_set` -- AC-3's
whole-key project-over-company overlay (ADR-007 §3: overlay, never a prose
merge), draft/retired exclusion. Pure function, two lists in, one list out
-- no DB, no HTTP.
"""

from __future__ import annotations

from datetime import UTC, datetime

from weave_backend.standards.effective import effective_set
from weave_backend.standards.models import StandardRecord


def _record(
    *,
    standard_key: str,
    scope: str = "company",
    status: str = "active",
    title: str = "title",
    project_id: str | None = None,
) -> StandardRecord:
    return StandardRecord(
        standard_id=f"id-{scope}-{standard_key}-{status}",
        tenant_id="t1",
        scope=scope,
        project_id=project_id,
        standard_key=standard_key,
        title=title,
        body_md="body",
        stack_pins=None,
        policy_iri="urn:weave:policy:t1:p1",
        status=status,
        created_by="urn:weave:principal:user:u1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def test_effective_set_overlays_project_standard_over_company_by_key() -> None:
    company = [
        _record(standard_key="lint", title="company-lint"),
        _record(standard_key="testing", title="company-testing"),
    ]
    project = [
        _record(standard_key="lint", scope="project", project_id="p1", title="project-lint"),
    ]

    result = effective_set(company, project)

    by_key = {r.standard_key: r for r in result}
    assert by_key["lint"].title == "project-lint"
    assert by_key["lint"].scope == "project"
    assert by_key["testing"].title == "company-testing"
    assert [r.standard_key for r in result] == ["lint", "testing"]  # sorted by key


def test_effective_set_orders_by_standard_key_regardless_of_input_order() -> None:
    """QA edge case (BE-V1-TASK-001): AC-3's `sorted by standard_key` must
    be real sort behaviour, not incidental preservation of already-sorted
    input -- feed both lists in reverse/interleaved key order.
    """
    company = [
        _record(standard_key="zebra"),
        _record(standard_key="middle"),
    ]
    project = [
        _record(standard_key="apple", scope="project", project_id="p1"),
    ]

    result = effective_set(company, project)

    assert [r.standard_key for r in result] == ["apple", "middle", "zebra"]


def test_effective_set_excludes_draft_and_retired_rows() -> None:
    company = [
        _record(standard_key="lint", status="active"),
        _record(standard_key="draft-only", status="draft"),
        _record(standard_key="retired-only", status="retired"),
    ]
    project: list[StandardRecord] = [
        _record(standard_key="proj-draft", scope="project", project_id="p1", status="draft"),
    ]

    result = effective_set(company, project)

    keys = {r.standard_key for r in result}
    assert keys == {"lint"}

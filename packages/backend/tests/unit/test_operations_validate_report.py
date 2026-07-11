"""Unit coverage for CE-TASK-006's report builder + stamp logic
(operations/validate_report.py). Test Requirements table: 3 unit scenarios.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from rdflib import Graph

from weave_backend.operations import shacl, validate_report
from weave_backend.operations.shacl import RuleSummary, ShaclResult
from weave_backend.tenancy.workspaces import Workspace


def _workspace() -> Workspace:
    return Workspace(
        id="w1",
        slug="ws",
        display_name="WS",
        named_graph_iri="urn:weave:tenant:t1:ws:w1",
        created_at=datetime.now(UTC),
    )


async def test_build_report_maps_pyshacl_results_including_info_severity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    results = [
        ShaclResult(
            focus_node="urn:e1",
            path="urn:p",
            severity="Info",
            message="advisory",
            shape_iri="urn:s1",
        )
    ]
    monkeypatch.setattr(
        shacl, "tenant_shapes_for_validation", AsyncMock(return_value=Graph())
    )
    monkeypatch.setattr(
        shacl, "validate_graph_with_shapes", lambda data_graph, shapes: results
    )
    monkeypatch.setattr(
        shacl,
        "list_rules",
        lambda shapes, *, tenant_id: [
            RuleSummary(shape_iri="urn:s1", severity="Info", description="d", origin="framework")
        ],
    )

    report = await validate_report.build_report(
        Graph(), tenant_id="t1", redis_client=None, version_resolved="urn:v1"
    )

    assert report.results[0].severity == "Info"
    assert report.results[0].shape_iri == "urn:s1"
    assert report.version_resolved == "urn:v1"


async def test_build_report_groups_violations_by_shape_with_counts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    results = [
        ShaclResult(
            focus_node="urn:e1", path=None, severity="Violation", message="m", shape_iri="urn:s1"
        ),
        ShaclResult(
            focus_node="urn:e2", path=None, severity="Violation", message="m", shape_iri="urn:s1"
        ),
    ]
    monkeypatch.setattr(
        shacl, "tenant_shapes_for_validation", AsyncMock(return_value=Graph())
    )
    monkeypatch.setattr(
        shacl, "validate_graph_with_shapes", lambda data_graph, shapes: results
    )
    monkeypatch.setattr(
        shacl,
        "list_rules",
        lambda shapes, *, tenant_id: [
            RuleSummary(
                shape_iri="urn:s1", severity="Violation", description="d", origin="framework"
            ),
            RuleSummary(
                shape_iri="urn:s2", severity="Warning", description="clean", origin="tenant"
            ),
        ],
    )

    report = await validate_report.build_report(
        Graph(), tenant_id="t1", redis_client=None, version_resolved="urn:v1"
    )

    by_shape = {rule.shape_iri: rule.violation_count for rule in report.rules}
    assert by_shape["urn:s1"] == 2
    assert by_shape["urn:s2"] == 0  # AC-006-03: zero-violation shapes still shown


async def test_resolve_graph_draft_stamp_moves_when_head_version_moves() -> None:
    """AC-006-04: the pending check is a stamp comparison -- a commit
    (which mints a new `head_version_iri`) must change the draft stamp,
    so a cached report keyed on the old stamp misses and the caller
    reports 'pending' instead of stale numbers."""
    conn_before = AsyncMock()
    conn_before.fetchrow.return_value = {"version_iri": "urn:weave:tenant:t1:ws:w1:v0.1.0"}
    conn_after = AsyncMock()
    conn_after.fetchrow.return_value = {"version_iri": "urn:weave:tenant:t1:ws:w1:v0.2.0"}
    workspace = _workspace()

    _, stamp_before = await validate_report.resolve_graph(
        conn_before, tenant_id="t1", workspace=workspace, version="draft"
    )
    _, stamp_after = await validate_report.resolve_graph(
        conn_after, tenant_id="t1", workspace=workspace, version="draft"
    )

    assert stamp_before != stamp_after
    composed_before = validate_report.compose_state_stamp(stamp_before, None)
    composed_after = validate_report.compose_state_stamp(stamp_after, None)
    assert composed_before != composed_after

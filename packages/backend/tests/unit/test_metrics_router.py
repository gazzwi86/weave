"""CE-METRICS-1 (TASK-007) unit tests: `routers/metrics.py`'s own
request-handling logic (workspace/RBAC resolution, cache short-circuit,
response shape) -- isolated from real Postgres/Oxigraph/Redis, which
`tests/integration/test_metrics.py` covers.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from contextlib import ExitStack, asynccontextmanager, contextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.audit.emitter import default_audit_emitter
from weave_backend.auth.dependencies import Principal
from weave_backend.operations import aggregate_metrics
from weave_backend.operations.aggregate_metrics import DeltaCounts
from weave_backend.rbac import InsufficientRole
from weave_backend.routers import metrics
from weave_backend.tenancy.workspaces import Workspace

PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[object]:
    yield object()


def _workspace(*, workspace_id: str = "ws-1") -> Workspace:
    return Workspace(
        id=workspace_id,
        slug=workspace_id,
        display_name=workspace_id,
        named_graph_iri=f"urn:weave:tenant:t1:ws:{workspace_id}",
        created_at=datetime.now(UTC),
    )


@contextmanager
def _base_patches(*, cached: dict[str, object] | None) -> Iterator[None]:
    with ExitStack() as stack:
        stack.enter_context(patch.object(metrics, "tenant_connection", _fake_tenant_connection))
        stack.enter_context(
            patch.object(metrics, "_resolve_workspace_id", AsyncMock(return_value="ws-1"))
        )
        stack.enter_context(
            patch.object(metrics, "get_workspace", AsyncMock(return_value=_workspace()))
        )
        stack.enter_context(
            patch.object(metrics, "enforce_workspace_role", AsyncMock(return_value=None))
        )
        stack.enter_context(patch.object(metrics, "get_redis", lambda: object()))
        stack.enter_context(
            patch.object(metrics, "get_cached_metrics", AsyncMock(return_value=cached))
        )
        stack.enter_context(patch.object(metrics, "store_metrics", AsyncMock(return_value=None)))
        yield


@pytest.mark.asyncio
async def test_metrics_ontology_route_returns_exact_contract_shape() -> None:
    """AC-007-01: exactly the contracted shape; AC-007-03: the never-yet-
    producer-backed fields always serve `{"pending": true}`, not zeros.
    """
    with (
        _base_patches(cached=None),
        patch.object(
            aggregate_metrics,
            "entity_count_by_kind",
            AsyncMock(return_value={"Process": 2}),
        ),
        patch.object(aggregate_metrics, "resolve_latest_version", AsyncMock(return_value=None)),
        patch.object(
            aggregate_metrics,
            "draft_published_delta",
            AsyncMock(return_value=DeltaCounts(added=2, removed=0, modified=0)),
        ),
    ):
        result = await metrics.metrics_ontology_route(PRINCIPAL, workspace_id=None)

    assert result.entity_count_by_kind == {"Process": 2}
    assert result.latest_version is None
    assert result.draft_published_delta.added == 2
    assert result.shacl_errors_by_severity.pending is True
    assert result.owl_inconsistencies.pending is True


@pytest.mark.asyncio
async def test_metrics_ontology_route_serves_second_call_from_cache_without_recomputing() -> None:
    """AC-007-05: a cache hit short-circuits before the SPARQL/diff/version
    computation runs at all.
    """
    cached_payload: dict[str, object] = {
        "entity_count_by_kind": {"Process": 2},
        "latest_version": None,
        "draft_published_delta": {"added": 2, "removed": 0, "modified": 0},
        "shacl_errors_by_severity": {"pending": True},
        "owl_inconsistencies": {"pending": True},
    }
    compute_spy = AsyncMock(return_value={"Process": 2})
    with (
        _base_patches(cached=cached_payload),
        patch.object(aggregate_metrics, "entity_count_by_kind", compute_spy),
    ):
        result = await metrics.metrics_ontology_route(PRINCIPAL, workspace_id=None)

    assert result.entity_count_by_kind == {"Process": 2}
    compute_spy.assert_not_called()


@pytest.mark.asyncio
async def test_metrics_ontology_route_raises_403_when_role_insufficient() -> None:
    """Mirrors `routers/ontology.py`'s read-role enforcement -- a tenant
    member with no (or too-low) role on this workspace must not see its
    metrics, even though RLS alone would let the query through.
    """
    with (
        patch.object(metrics, "tenant_connection", _fake_tenant_connection),
        patch.object(metrics, "_resolve_workspace_id", AsyncMock(return_value="ws-1")),
        patch.object(metrics, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(
            metrics, "enforce_workspace_role", AsyncMock(side_effect=InsufficientRole("read"))
        ),
        patch.object(default_audit_emitter, "emit", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await metrics.metrics_ontology_route(PRINCIPAL, workspace_id=None)

    assert exc_info.value.status_code == 403

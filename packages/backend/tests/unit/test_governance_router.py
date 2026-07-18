"""CE-TASK-005 unit tests: `routers/governance.py` -- the NL-authoring
"family" surface for tenant governance shapes (AC-005-01/-05/-07). Mirrors
`test_project_settings_router.py`'s direct-call pattern: call the route
coroutine directly with a `Principal` (bypassing `Depends`), `tenant_connection`
and `get_redis` patched, no docker/Postgres needed.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from rdflib import Graph

from weave_backend.auth.dependencies import Principal
from weave_backend.authoring.shapes import ShapeGenerationError
from weave_backend.operations.governance_shapes import (
    FrameworkShapeImmutableError,
    ShapeNotFoundError,
)
from weave_backend.routers.governance import (
    commit_shape_route,
    preview_shape_route,
    retire_shape_route,
)
from weave_backend.schemas.governance import ShapeRuleCommitRequest, ShapeRulePreviewRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")

_VALID_SHAPE_TURTLE = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<https://weave.io/instances/shape-abc> a sh:NodeShape ;
    sh:targetClass weave:Process ;
    sh:property [ sh:path weave:performedBy ; sh:minCount 1 ] .
"""


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[object]:
    yield object()


async def test_preview_route_returns_generated_shape_turtle() -> None:
    graph = Graph()
    graph.parse(data=_VALID_SHAPE_TURTLE, format="turtle")

    with patch(
        "weave_backend.routers.governance.generate_candidate_shape", return_value=graph
    ):
        response = await preview_shape_route(
            ShapeRulePreviewRequest(text="every Process must name an owner"), _PRINCIPAL
        )

    assert "sh:NodeShape" in response.shape_turtle or "NodeShape" in response.shape_turtle


async def test_preview_route_returns_422_when_ai_output_unusable() -> None:
    with (
        patch(
            "weave_backend.routers.governance.generate_candidate_shape",
            side_effect=ShapeGenerationError("model output failed candidate-shape schema"),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await preview_shape_route(
            ShapeRulePreviewRequest(text="do something vague"), _PRINCIPAL
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["error"] == "shape_generation_failed"  # type: ignore[index]


async def test_preview_route_returns_503_when_ai_provider_unavailable() -> None:
    """AC-005-07: the AI service is unavailable -> 503 on the NL surface."""
    with (
        patch(
            "weave_backend.routers.governance.generate_candidate_shape",
            side_effect=ConnectionError("refused"),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await preview_shape_route(
            ShapeRulePreviewRequest(text="every Process must name an owner"), _PRINCIPAL
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "model_provider_unavailable"}  # type: ignore[comparison-overlap]


async def test_commit_route_rejects_invalid_shape_without_committing() -> None:
    """AC-005-05: never commits an unreviewed or invalid shape -- syntax/
    predicate gate runs again server-side, even on the raw-SHACL path.
    """
    commit_spy = AsyncMock()
    with (
        patch("weave_backend.routers.governance.commit_tenant_shape", commit_spy),
        pytest.raises(HTTPException) as exc_info,
    ):
        await commit_shape_route(
            ShapeRuleCommitRequest(shape_turtle="not valid turtle {{{", ai_generated=False),
            _PRINCIPAL,
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["error"] == "invalid_shape"  # type: ignore[index]
    commit_spy.assert_not_called()


async def test_commit_route_commits_valid_shape_and_returns_activity_iri() -> None:
    with (
        patch(
            "weave_backend.routers.governance.tenant_connection", _fake_tenant_connection
        ),
        patch("weave_backend.routers.governance.get_redis", return_value=AsyncMock()),
        patch(
            "weave_backend.routers.governance.commit_tenant_shape",
            AsyncMock(return_value="urn:weave:instances:activity-1"),
        ) as commit_spy,
    ):
        response = await commit_shape_route(
            ShapeRuleCommitRequest(shape_turtle=_VALID_SHAPE_TURTLE, ai_generated=True),
            _PRINCIPAL,
        )

    commit_spy.assert_awaited_once()
    request = commit_spy.call_args.args[2]
    assert request.tenant_id == "t1"
    assert request.approver_iri == _PRINCIPAL.principal_iri
    assert request.ai_generated is True
    assert response.activity_iri == "urn:weave:instances:activity-1"
    assert response.shape_iri == "https://weave.io/instances/shape-abc"


# G3 (remediation-2-api-gaps.md): DELETE /api/ontology/authoring/shapes


async def test_retire_route_retires_and_returns_204() -> None:
    retire_spy = AsyncMock()
    with (
        patch("weave_backend.routers.governance.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.governance.get_redis", return_value=AsyncMock()),
        patch("weave_backend.routers.governance.retire_tenant_shape", retire_spy),
    ):
        await retire_shape_route("https://weave.io/instances/shape-abc", _PRINCIPAL)

    retire_spy.assert_awaited_once()
    kwargs = retire_spy.call_args.kwargs
    assert kwargs["tenant_id"] == "t1"
    assert kwargs["approver_iri"] == _PRINCIPAL.principal_iri
    assert kwargs["shape_iri"] == "https://weave.io/instances/shape-abc"


async def test_retire_route_returns_404_for_unknown_shape() -> None:
    with (
        patch("weave_backend.routers.governance.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.governance.get_redis", return_value=AsyncMock()),
        patch(
            "weave_backend.routers.governance.retire_tenant_shape",
            AsyncMock(side_effect=ShapeNotFoundError("urn:x")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await retire_shape_route("urn:x", _PRINCIPAL)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail["error"] == "shape_not_found"  # type: ignore[index]


async def test_retire_route_returns_403_for_framework_shape() -> None:
    with (
        patch("weave_backend.routers.governance.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.governance.get_redis", return_value=AsyncMock()),
        patch(
            "weave_backend.routers.governance.retire_tenant_shape",
            AsyncMock(side_effect=FrameworkShapeImmutableError("https://weave.io/ontology/ProcessShape")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await retire_shape_route("https://weave.io/ontology/ProcessShape", _PRINCIPAL)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error"] == "framework_shape_immutable"  # type: ignore[index]

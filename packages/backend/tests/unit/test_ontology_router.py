"""CE-TASK-002 E9-S3 unit tests: `routers/ontology.py`'s own request-handling
logic (workspace resolution, publish status mapping, diff 404s) -- isolated
from real Postgres/Oxigraph, which `tests/integration/test_ontology.py`
covers.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.operations import diff, versioning
from weave_backend.operations.diff import DiffResult, Modification, Triple
from weave_backend.rbac import InsufficientRole
from weave_backend.routers import ontology
from weave_backend.tenancy.workspaces import Workspace

PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")

V1 = "urn:weave:tenant:t1:ws:ws-1:v0.1.0"
V2 = "urn:weave:tenant:t1:ws:ws-1:v0.1.1"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[object]:
    """Stands in for `db.pool.tenant_connection` -- every DB call the route
    makes on this fake `conn` is itself mocked out in these tests, so the
    connection object's identity never matters.
    """
    yield object()


def _workspace(*, workspace_id: str = "ws-1") -> Workspace:
    return Workspace(
        id=workspace_id,
        slug=workspace_id,
        display_name=workspace_id,
        named_graph_iri=f"urn:weave:tenant:t1:ws:{workspace_id}",
        created_at=datetime.now(UTC),
    )


def _version(
    *, version_iri: str, status: str = "draft", workspace_id: str = "ws-1"
) -> versioning.GraphVersion:
    return versioning.GraphVersion(
        version_iri=version_iri,
        semver="0.1.0",
        status=status,
        created_at=datetime.now(UTC),
        published_at=None,
        actor_iri=PRINCIPAL.principal_iri,
        workspace_id=workspace_id,
    )


async def test_list_versions_route_returns_paginated_newest_first_history() -> None:
    page_result = versioning.VersionPage(
        versions=[_version(version_iri=V2, status="published"), _version(version_iri=V1)],
        total=2,
    )
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(ontology, "_resolve_workspace_id", AsyncMock(return_value="ws-1")),
        patch.object(ontology, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(ontology, "_authorize_read", AsyncMock(return_value=None)),
        patch.object(versioning, "list_versions", AsyncMock(return_value=page_result)),
    ):
        result = await ontology.list_versions_route(
            PRINCIPAL, workspace_id=None, page=1, per_page=50
        )

    assert result.total == 2
    assert [v.version_iri for v in result.versions] == [V2, V1]
    assert result.versions[0].status == "published"


async def test_authorize_workspace_role_denies_and_audits_insufficient_role() -> None:
    """Pure-logic proof of the deferred-raise pattern: `_authorize_workspace_role`
    must emit `access.rbac.denied` BEFORE returning the denial (never raises
    it directly), so the caller can commit the audit insert while still
    inside its transaction.
    """
    emitter = AsyncMock()
    with (
        patch.object(
            ontology, "enforce_workspace_role", AsyncMock(side_effect=InsufficientRole("read"))
        ),
        patch.object(ontology, "default_audit_emitter", emitter),
    ):
        denied = await ontology._authorize_workspace_role(
            object(), principal=PRINCIPAL, workspace=_workspace(), min_role="read"
        )

    assert isinstance(denied, HTTPException)
    assert denied.status_code == 403
    emitter.emit.assert_awaited_once()
    audited_event = emitter.emit.await_args.args[1]
    assert audited_event.event_type == "access.rbac.denied"
    assert audited_event.payload == {"required_role": "read"}


async def test_publish_route_404s_when_version_does_not_exist() -> None:
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(versioning, "get_version", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await ontology.publish_version_route(V1, PRINCIPAL)

    assert exc_info.value.status_code == 404


async def test_publish_route_maps_already_published_to_405_with_ac_002_09_message() -> None:
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(versioning, "get_version", AsyncMock(return_value=_version(version_iri=V1))),
        patch.object(ontology, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(ontology, "enforce_workspace_role", AsyncMock()),
        patch.object(
            versioning,
            "publish_version",
            AsyncMock(side_effect=versioning.VersionAlreadyPublished(V1)),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await ontology.publish_version_route(V1, PRINCIPAL)

    assert exc_info.value.status_code == 405
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "message": "version is published and immutable"
    }


async def test_publish_route_returns_published_version_on_success() -> None:
    published = _version(version_iri=V1, status="published")
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(versioning, "get_version", AsyncMock(return_value=_version(version_iri=V1))),
        patch.object(ontology, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(ontology, "enforce_workspace_role", AsyncMock()),
        patch.object(versioning, "publish_version", AsyncMock(return_value=published)),
        patch.object(ontology, "default_audit_emitter", AsyncMock()),
    ):
        result = await ontology.publish_version_route(V1, PRINCIPAL)

    assert result.version_iri == V1
    assert result.status == "published"


async def test_publish_route_denies_and_audits_insufficient_role() -> None:
    """PR #23 finding #5: a denied publish must still write an
    `access.rbac.denied` PLAT-AUDIT-1 entry before the 403 propagates.
    """
    emitter = AsyncMock()
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(versioning, "get_version", AsyncMock(return_value=_version(version_iri=V1))),
        patch.object(ontology, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(
            ontology, "enforce_workspace_role", AsyncMock(side_effect=InsufficientRole("publish"))
        ),
        patch.object(ontology, "default_audit_emitter", emitter),
        pytest.raises(HTTPException) as exc_info,
    ):
        await ontology.publish_version_route(V1, PRINCIPAL)

    assert exc_info.value.status_code == 403
    emitter.emit.assert_awaited_once()
    audited_event = emitter.emit.await_args.args[1]
    assert audited_event.event_type == "access.rbac.denied"
    assert audited_event.subject_iri == _workspace().named_graph_iri


async def test_diff_route_404s_when_from_version_is_unknown() -> None:
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(ontology, "_resolve_workspace_id", AsyncMock(return_value="ws-1")),
        patch.object(ontology, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(ontology, "_authorize_read", AsyncMock(return_value=None)),
        patch.object(
            versioning, "resolve_version", AsyncMock(side_effect=lambda *a, **kw: kw["version"])
        ),
        patch.object(versioning, "get_version", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await ontology.diff_route(PRINCIPAL, from_=V1, to=V2, workspace_id=None)

    assert exc_info.value.status_code == 404


async def test_diff_route_404s_when_latest_resolves_to_no_published_version() -> None:
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(ontology, "_resolve_workspace_id", AsyncMock(return_value="ws-1")),
        patch.object(ontology, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(ontology, "_authorize_read", AsyncMock(return_value=None)),
        patch.object(
            versioning,
            "resolve_version",
            AsyncMock(side_effect=versioning.VersionNotFound("latest")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await ontology.diff_route(PRINCIPAL, from_="latest", to=V2, workspace_id=None)

    assert exc_info.value.status_code == 404


async def test_diff_route_returns_computed_diff_for_known_versions() -> None:
    diff_result = DiffResult(
        added=[Triple(subject="s1", predicate="p1", object="o1")],
        removed=[],
        modified=[Modification(subject="s2", predicate="p2", before="a", after="b")],
    )
    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(ontology, "_resolve_workspace_id", AsyncMock(return_value="ws-1")),
        patch.object(ontology, "get_workspace", AsyncMock(return_value=_workspace())),
        patch.object(ontology, "_authorize_read", AsyncMock(return_value=None)),
        patch.object(
            versioning, "resolve_version", AsyncMock(side_effect=lambda *a, **kw: kw["version"])
        ),
        patch.object(versioning, "get_version", AsyncMock(return_value=_version(version_iri=V1))),
        patch.object(diff, "compute_diff", AsyncMock(return_value=diff_result)),
    ):
        result = await ontology.diff_route(PRINCIPAL, from_=V1, to=V2, workspace_id=None)

    assert result.added[0].subject == "s1"
    assert result.removed == []
    assert result.modified[0].before == "a"
    assert result.modified[0].after == "b"


async def test_diff_route_authorizes_against_each_versions_real_workspace() -> None:
    """PR #23 finding #1 (IDOR): an explicit version_iri may belong to a
    DIFFERENT workspace than the caller's active/query one -- the read must
    be authorized against that version's REAL `workspace_id`, not the
    caller-supplied one.
    """
    known_versions = {
        V1: _version(version_iri=V1, workspace_id="ws-owner"),
        V2: _version(version_iri=V2, workspace_id="ws-other"),
    }
    diff_result = DiffResult(added=[], removed=[], modified=[])
    authorize_read = AsyncMock(return_value=None)

    async def _fake_get_workspace(_conn: object, *, tenant_id: str, workspace_id: str) -> object:
        return _workspace(workspace_id=workspace_id)

    async def _fake_get_version(
        _conn: object, *, tenant_id: str, version_iri: str
    ) -> versioning.GraphVersion:
        return known_versions[version_iri]

    with (
        patch.object(ontology, "tenant_connection", _fake_tenant_connection),
        patch.object(ontology, "_resolve_workspace_id", AsyncMock(return_value="ws-caller")),
        patch.object(ontology, "get_workspace", _fake_get_workspace),
        patch.object(ontology, "_authorize_read", authorize_read),
        patch.object(
            versioning, "resolve_version", AsyncMock(side_effect=lambda *a, **kw: kw["version"])
        ),
        patch.object(versioning, "get_version", _fake_get_version),
        patch.object(diff, "compute_diff", AsyncMock(return_value=diff_result)),
    ):
        await ontology.diff_route(PRINCIPAL, from_=V1, to=V2, workspace_id=None)

    authorized_workspace_ids = [
        call.kwargs["workspace"].id for call in authorize_read.await_args_list
    ]
    assert authorized_workspace_ids == ["ws-owner", "ws-other"]


async def test_ontology_types_route_returns_catalogue_kinds_and_relationships() -> None:
    """AC-003-01: `GET /api/ontology/types` returns the live SHACL-shape
    catalogue -- no tenant/workspace scoping, auth-only (AC-003-07 is
    enforced by the shared `get_current_principal` dependency, proved by
    `test_public_routes_guarded.py::test_real_app_passes_the_guard`).
    """
    response = await ontology.ontology_types_route(PRINCIPAL)

    kind_iris = {k.iri for k in response.kinds}
    assert "https://weave.io/ontology/Process" in kind_iris
    relationship_paths = {r.path for r in response.relationships}
    assert "https://weave.io/ontology/performedBy" in relationship_paths
    assert "https://weave.io/ontology/label" not in relationship_paths

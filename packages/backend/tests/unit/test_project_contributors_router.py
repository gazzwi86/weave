"""TASK-014 QA-retry unit tests: `routers/project_contributors.py` (64%
before this file -- list/add/remove route bodies were only docker-lane
tested). Mirrors `tests/unit/test_projects_router.py`'s direct-call
pattern: call the route coroutine directly with `tenant_connection` and its
`pm.contributors` collaborators patched, no docker/Postgres needed.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.auth.dependencies import Principal
from weave_backend.pm.contributors import Contributor
from weave_backend.rbac import InsufficientProjectRole, ProjectAction, require_project_role
from weave_backend.routers.project_contributors import (
    delete_contributor_route,
    list_contributors_route,
    upsert_contributor_route,
)
from weave_backend.schemas.contributors import UpsertContributorRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:admin-1")
_PROJECT_IRI = "urn:weave:project:t1:acme-corp"
_TARGET_IRI = "urn:weave:principal:user:u-2"
_CONTRIBUTOR = Contributor(
    project_iri=_PROJECT_IRI,
    principal_iri=_TARGET_IRI,
    role="editor",
    added_by=_PRINCIPAL.principal_iri,
    added_at=datetime(2026, 7, 1, tzinfo=UTC),
)


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_list_contributors_route_returns_all_contributors() -> None:
    with (
        patch(
            "weave_backend.routers.project_contributors.tenant_connection",
            _fake_tenant_connection,
        ),
        patch(
            "weave_backend.routers.project_contributors.get_all",
            AsyncMock(return_value=[_CONTRIBUTOR]),
        ),
    ):
        result = await list_contributors_route(_PROJECT_IRI, _PRINCIPAL)

    assert len(result.items) == 1
    assert result.items[0].principal_iri == _TARGET_IRI
    assert result.items[0].role == "editor"


async def test_upsert_contributor_route_adds_a_contributor_as_admin() -> None:
    body = UpsertContributorRequest(role="editor")

    with (
        patch(
            "weave_backend.routers.project_contributors.tenant_connection",
            _fake_tenant_connection,
        ),
        patch(
            "weave_backend.routers.project_contributors.upsert",
            AsyncMock(return_value=_CONTRIBUTOR),
        ) as upsert_mock,
    ):
        result = await upsert_contributor_route(_PROJECT_IRI, _TARGET_IRI, body, _PRINCIPAL)

    assert result.principal_iri == _TARGET_IRI
    assert result.role == "editor"
    upsert_mock.assert_awaited_once()
    assert upsert_mock.await_args is not None
    kwargs = upsert_mock.await_args.kwargs
    assert kwargs["contributor"].project_iri == _PROJECT_IRI
    assert kwargs["contributor"].principal_iri == _TARGET_IRI
    assert kwargs["contributor"].role == "editor"
    assert kwargs["contributor"].added_by == _PRINCIPAL.principal_iri


async def test_delete_contributor_route_removes_a_contributor_as_admin() -> None:
    with (
        patch(
            "weave_backend.routers.project_contributors.tenant_connection",
            _fake_tenant_connection,
        ),
        patch(
            "weave_backend.routers.project_contributors.delete", AsyncMock(return_value=None)
        ) as delete_mock,
    ):
        await delete_contributor_route(_PROJECT_IRI, _TARGET_IRI, _PRINCIPAL)

    delete_mock.assert_awaited_once_with(
        None, tenant_id=_PRINCIPAL.tenant_id, project_iri=_PROJECT_IRI, principal_iri=_TARGET_IRI
    )


async def test_contributors_guard_403s_editor_without_contributors_action() -> None:
    """PUT/DELETE .../contributors guard: an editor grant (`PROJECT_ROLE_
    ACTIONS` has no `CONTRIBUTORS` for "editor") is refused. Exercises the
    exact `require_project_role` dependency closure both mutation routes
    wire via `Depends(...)`, not a re-implementation of the guard logic
    (already unit-tested at the rbac layer in `test_rbac.py`).
    """
    dependency = require_project_role(ProjectAction.CONTRIBUTORS)

    with (
        patch("weave_backend.rbac.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.rbac.get_contributor_role", AsyncMock(return_value="editor")),
        pytest.raises(InsufficientProjectRole) as exc_info,
    ):
        await dependency(_PROJECT_IRI, _PRINCIPAL)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "forbidden",
        "action": "contributors",
    }

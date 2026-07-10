"""TASK-014 QA-retry unit tests: `routers/project_settings.py` (43% before
this file -- the security-critical PATCH route body was previously only
docker-lane tested). Mirrors `tests/unit/test_projects_router.py`'s
direct-call pattern: call the route coroutine directly with `tenant_connection`
and its collaborators patched, no docker/Postgres needed. Governance-layer
correctness (`validate_model_tier`/`validate_cap_against_parent`/
`resolve_governance`) is already unit-tested in `test_project_governance.py`;
these tests focus on the router body's own branching (422/503 mapping,
success shape) plus AC-6 (no secret fields in the response schema).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.projects.governance import CapLooserThanParent, GovernanceSnapshot
from weave_backend.rbac import InsufficientProjectRole, ProjectAction, require_project_role
from weave_backend.routers.project_settings import (
    get_project_settings_route,
    update_project_settings_route,
)
from weave_backend.schemas.project_settings import (
    ProjectSettingsResponse,
    UpdateProjectSettingsRequest,
)
from weave_backend.settings.scope import InvalidScopeIri

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_PROJECT_IRI = "urn:weave:project:t1:acme-corp"
_SNAPSHOT = GovernanceSnapshot(
    model_tier="premium", model_tier_source="company", cap_usd=100.0, cap_source="company"
)


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_get_project_settings_route_returns_resolved_snapshot() -> None:
    with (
        patch("weave_backend.routers.project_settings.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.project_settings.resolve_governance",
            AsyncMock(return_value=_SNAPSHOT),
        ),
    ):
        result = await get_project_settings_route(_PROJECT_IRI, _PRINCIPAL)

    assert result == ProjectSettingsResponse(
        model_tier="premium",
        model_tier_source="company",
        cost_cap_usd=100.0,
        cost_cap_source="company",
    )


async def test_update_project_settings_route_success_at_company_scope() -> None:
    """AC-2/AC-3/AC-4: a valid tier + a cap under the company cap persists
    (both `set_setting` calls succeed) and the route returns the re-resolved
    snapshot.
    """
    body = UpdateProjectSettingsRequest(model_tier="premium", cost_cap_usd=50.0)
    set_setting_mock = AsyncMock(return_value=None)

    with (
        patch("weave_backend.routers.project_settings.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.project_settings.validate_cap_against_parent",
            AsyncMock(return_value=None),
        ),
        patch("weave_backend.routers.project_settings.set_setting", set_setting_mock),
        patch(
            "weave_backend.routers.project_settings.resolve_governance",
            AsyncMock(return_value=_SNAPSHOT),
        ),
    ):
        result = await update_project_settings_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert set_setting_mock.await_count == 2
    assert result.model_tier == "premium"
    assert result.cost_cap_usd == 100.0


async def test_update_project_settings_route_422_when_model_tier_invalid() -> None:
    body = UpdateProjectSettingsRequest(model_tier="bogus")

    with (
        patch("weave_backend.routers.project_settings.tenant_connection", _fake_tenant_connection),
        pytest.raises(HTTPException) as exc_info,
    ):
        await update_project_settings_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "invalid_model_tier",
        "tier": "bogus",
    }


async def test_update_project_settings_route_422_when_cap_looser_than_parent() -> None:
    body = UpdateProjectSettingsRequest(cost_cap_usd=500.0)

    with (
        patch("weave_backend.routers.project_settings.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.project_settings.validate_cap_against_parent",
            AsyncMock(side_effect=CapLooserThanParent(100.0, level="company")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await update_project_settings_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "cap_looser_than_parent",
        "level": "company",
        "parent_cap_usd": 100.0,
    }


async def test_update_project_settings_route_503_when_project_scope_unavailable() -> None:
    """ADR-013: a Build project IRI never parses under the scope grammar, so
    a persist attempt always 503s rather than silently writing at company
    scope (which would be a privilege escalation).
    """
    body = UpdateProjectSettingsRequest(model_tier="fast")

    with (
        patch("weave_backend.routers.project_settings.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.project_settings.set_setting",
            AsyncMock(side_effect=InvalidScopeIri(_PROJECT_IRI)),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await update_project_settings_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "project_scope_settings_unavailable"
    }


async def test_patch_settings_guard_403s_editor_without_settings_action() -> None:
    """PATCH .../settings guard: an editor grant (`PROJECT_ROLE_ACTIONS`
    has no `SETTINGS` for "editor") is refused. Exercises the exact
    `require_project_role` dependency closure the route wires via
    `Depends(...)`, not a re-implementation of the guard logic (already
    unit-tested at the rbac layer in `test_rbac.py`).
    """
    dependency = require_project_role(ProjectAction.SETTINGS)

    with (
        patch("weave_backend.rbac.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.rbac.get_contributor_role", AsyncMock(return_value="editor")),
        pytest.raises(InsufficientProjectRole) as exc_info,
    ):
        await dependency(_PROJECT_IRI, _PRINCIPAL)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {"error": "forbidden", "action": "settings"}  # type: ignore[comparison-overlap]


def test_project_settings_response_schema_never_exposes_secret_fields() -> None:
    """AC-6: structural guarantee -- `ProjectSettingsResponse` has no field
    whose name or value could carry a secret, in both a fully-resolved
    (company-scope) response and the safe-default (nothing configured)
    response `resolve_governance` returns when no cascade level matches.
    """
    banned = ("secret", "token", "password", "credential")
    field_names = " ".join(ProjectSettingsResponse.model_fields).lower()
    assert not any(bad in field_names for bad in banned)

    resolved = ProjectSettingsResponse(
        model_tier="premium",
        model_tier_source="company",
        cost_cap_usd=100.0,
        cost_cap_source="company",
    )
    default = ProjectSettingsResponse(
        model_tier="standard", model_tier_source="default", cost_cap_usd=None, cost_cap_source=None
    )
    for response in (resolved, default):
        dumped = " ".join(str(v) for v in response.model_dump().values()).lower()
        assert not any(bad in dumped for bad in banned)

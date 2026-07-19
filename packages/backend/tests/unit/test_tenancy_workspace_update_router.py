"""SE1 (docs/design/remediation-2-api-gaps.md): `PUT /api/tenants/{tenant_id}/
workspaces/{workspace_id}` -- the tenant-admin-gated workspace-description
write. Mirrors `test_settings_models_router.py`'s direct-call, DB-free
pattern: `tenant_connection` faked, `update_workspace_description` patched.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, get_type_hints
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.rbac import require_tenant_admin
from weave_backend.routers import tenancy
from weave_backend.schemas.tenancy import UpdateWorkspaceRequest
from weave_backend.tenancy.workspaces import Workspace

_PRINCIPAL = Principal(
    sub="u-1", tenant_id="acme-corp", principal_iri="urn:weave:principal:user:u-1"
)


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _depends_target(route_func: Any) -> Any:
    hints = get_type_hints(route_func, include_extras=True)
    return hints["principal"].__metadata__[0].dependency


class TestUpdateWorkspaceRouteAuthzWiring:
    def test_put_is_gated_to_tenant_admins(self) -> None:
        assert _depends_target(tenancy.update_workspace_route) is require_tenant_admin


class TestUpdateWorkspaceRoute:
    async def test_updates_description_and_returns_the_workspace(self) -> None:
        updated = Workspace(
            id="ws-1",
            slug="engineering",
            display_name="Engineering",
            named_graph_iri="urn:weave:tenant:acme-corp:ws:ws-1",
            description="Ships the platform.",
            created_at=datetime.now(UTC),
        )
        update_mock = AsyncMock(return_value=updated)
        emit_mock = AsyncMock(return_value=None)

        with (
            patch("weave_backend.routers.tenancy.tenant_connection", _fake_tenant_connection),
            patch("weave_backend.routers.tenancy.update_workspace_description", update_mock),
            patch("weave_backend.routers.tenancy.default_audit_emitter.emit", emit_mock),
        ):
            result = await tenancy.update_workspace_route(
                "acme-corp",
                "ws-1",
                UpdateWorkspaceRequest(description="Ships the platform."),
                _PRINCIPAL,
            )

        update_mock.assert_awaited_once_with(
            None, tenant_id="acme-corp", workspace_id="ws-1", description="Ships the platform."
        )
        emit_mock.assert_awaited_once()
        assert result.description == "Ships the platform."

    async def test_mismatched_tenant_in_the_url_is_rejected_as_403(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await tenancy.update_workspace_route(
                "someone-elses-tenant",
                "ws-1",
                UpdateWorkspaceRequest(description="x"),
                _PRINCIPAL,
            )

        assert exc_info.value.status_code == 403

    async def test_a_foreign_or_nonexistent_workspace_id_404s(self) -> None:
        update_mock = AsyncMock(return_value=None)

        with (
            patch("weave_backend.routers.tenancy.tenant_connection", _fake_tenant_connection),
            patch("weave_backend.routers.tenancy.update_workspace_description", update_mock),
            pytest.raises(HTTPException) as exc_info,
        ):
            await tenancy.update_workspace_route(
                "acme-corp",
                "missing",
                UpdateWorkspaceRequest(description="x"),
                _PRINCIPAL,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail["error"] == "workspace_not_found"  # type: ignore[index]

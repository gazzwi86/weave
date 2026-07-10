"""TASK-023 (E2-S6, FR-061/B9) unit tests: `routers/source_control.py`.
Mirrors `test_project_bindings_router.py`'s direct-call pattern -- no
docker/Postgres needed for these.

AC-1 (the crux): a rejected/failed PUT must never echo the token value in
any response, including the 500 path when the Secrets Manager write itself
fails. `should never echo source-control token in any response`'s
integration-lane counterpart (docker+LocalStack, `test_repo_bootstrap.py`
sibling) proves the 200/GET/422 paths against the real stack; this file
proves the 500 (secrets-manager failure) path, which is cheapest to fake
here.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.pm.source_control import ConfiguredMeta, SourceControlConfig
from weave_backend.rbac import InsufficientProjectRole, ProjectAction, require_project_role
from weave_backend.routers.source_control import (
    get_source_control_route,
    put_source_control_route,
)
from weave_backend.schemas.source_control import SourceControlPutRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:admin-1")
_PROJECT_IRI = "urn:weave:project:t1:acme-corp"

# Named `_sentinel` (not `*token*`) so it never collides with the repo's own
# hardcoded-secret pre-commit scan pattern (see test_schemas_source_control.py).
_sentinel = "SENTINEL-VALUE-DO-NOT-LEAK-9f2c1a"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_get_route_returns_404_when_unconfigured() -> None:
    """AC-5: unset config reads as 404 -- the frontend treats this as the
    normal setup state (SetupCard), not an error.
    """
    with (
        patch("weave_backend.routers.source_control.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.source_control.get_row", AsyncMock(return_value=None)
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_source_control_route(_PROJECT_IRI, _PRINCIPAL)

    assert exc_info.value.status_code == 404


async def test_get_route_returns_config_when_configured() -> None:
    with (
        patch("weave_backend.routers.source_control.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.source_control.get_row",
            AsyncMock(
                return_value=SourceControlConfig(
                    provider="github", token_secret_ref="weave/t1/scm/acme-corp/github/token"
                )
            ),
        ),
        patch(
            "weave_backend.routers.source_control.get_configured_meta",
            AsyncMock(
                return_value=ConfiguredMeta(
                    configured_by="urn:weave:person:bob", configured_at="2026-07-01T00:00:00+00:00"
                )
            ),
        ),
    ):
        result = await get_source_control_route(_PROJECT_IRI, _PRINCIPAL)

    assert result.provider == "github"
    assert result.token_secret_ref == "weave/t1/scm/acme-corp/github/token"
    assert result.configured_by == "urn:weave:person:bob"
    assert not hasattr(result, "token")


async def test_put_route_rejects_when_project_does_not_exist() -> None:
    body = SourceControlPutRequest(provider="github", token=_sentinel)

    with (
        patch("weave_backend.routers.source_control.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.source_control.project_exists", AsyncMock(return_value=False)
        ),
        patch(
            "weave_backend.routers.source_control.put_scm_token", AsyncMock()
        ) as put_scm_token_mock,
        pytest.raises(HTTPException) as exc_info,
    ):
        await put_source_control_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert exc_info.value.status_code == 404
    # AC-1: never write a secret for a project that doesn't exist
    put_scm_token_mock.assert_not_awaited()


async def test_put_route_stores_token_and_persists_reference_only() -> None:
    body = SourceControlPutRequest(provider="github", token=_sentinel)

    with (
        patch("weave_backend.routers.source_control.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.source_control.project_exists", AsyncMock(return_value=True)
        ),
        patch(
            "weave_backend.routers.source_control.build_scm_secret_ref",
            lambda **_kw: "weave/t1/scm/acme-corp/github/token",
        ),
        patch(
            "weave_backend.routers.source_control.put_scm_token", AsyncMock()
        ) as put_scm_token_mock,
        patch("weave_backend.routers.source_control.set_row", AsyncMock()) as set_row_mock,
        patch(
            "weave_backend.routers.source_control.default_audit_emitter.emit", AsyncMock()
        ) as emit_mock,
        patch(
            "weave_backend.routers.source_control.get_configured_meta",
            AsyncMock(
                return_value=ConfiguredMeta(
                    configured_by=_PRINCIPAL.principal_iri,
                    configured_at="2026-07-10T00:00:00+00:00",
                )
            ),
        ),
    ):
        result = await put_source_control_route(_PROJECT_IRI, body, _PRINCIPAL)

    put_scm_token_mock.assert_awaited_once_with(
        "weave/t1/scm/acme-corp/github/token", _sentinel
    )
    set_row_mock.assert_awaited_once()
    assert set_row_mock.await_args is not None
    kwargs = set_row_mock.await_args.kwargs
    assert kwargs["provider"] == "github"
    assert kwargs["token_secret_ref"] == "weave/t1/scm/acme-corp/github/token"
    emit_mock.assert_awaited_once()
    assert result.provider == "github"
    assert result.token_secret_ref == "weave/t1/scm/acme-corp/github/token"
    assert not hasattr(result, "token")


async def test_put_route_never_echoes_token_when_secrets_manager_write_fails() -> None:
    """AC-1 crux: a Secrets Manager failure must never surface the token
    value anywhere -- including in the exception itself.
    """
    body = SourceControlPutRequest(provider="github", token=_sentinel)

    with (
        patch("weave_backend.routers.source_control.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.source_control.project_exists", AsyncMock(return_value=True)
        ),
        patch(
            "weave_backend.routers.source_control.build_scm_secret_ref",
            lambda **_kw: "weave/t1/scm/acme-corp/github/token",
        ),
        patch(
            "weave_backend.routers.source_control.put_scm_token",
            AsyncMock(side_effect=RuntimeError("secrets manager unavailable")),
        ),
        pytest.raises(RuntimeError) as exc_info,
    ):
        await put_source_control_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert _sentinel not in str(exc_info.value)


async def test_source_control_guard_403s_editor_without_settings_action() -> None:
    """PUT .../source-control guard: an editor grant (`PROJECT_ROLE_ACTIONS`
    has no `SETTINGS` for "editor") is refused (AC-3 admin-only).
    """
    dependency = require_project_role(ProjectAction.SETTINGS)

    with (
        patch("weave_backend.rbac.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.rbac.get_contributor_role", AsyncMock(return_value="editor")),
        pytest.raises(InsufficientProjectRole) as exc_info,
    ):
        await dependency(_PROJECT_IRI, _PRINCIPAL)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "forbidden",
        "action": "settings",
    }

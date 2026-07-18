"""G13 (docs/design/remediation-2-api-gaps.md): `GET/PUT /api/settings/models`
-- the model allow-list + current tier routing, previously readable only from
source (`ai/config.py::MODEL_ROUTING_TABLE` / `build/model_routing.py::
ALLOWED_MODELS`). Mirrors `test_project_settings_router.py`'s direct-call,
DB-free pattern: `tenant_connection` is faked, `resolve_setting`/`set_setting`
are the real PLAT-SETTINGS-1 functions exercised against a fake connection
only where cheap, or patched where a full cascade round-trip isn't the point.

Tier keys are the real internal names (`fable`, `sonnet` -- see
`ai/config.py::MODEL_ROUTING_TABLE`), not the task brief's illustrative
`high`/`mid` -- the frontend's existing Models & AI page
(`app/settings/models/page.tsx`) already speaks `fable`/`sonnet`, so this is
consuming the one real name, not inventing a second one.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, get_type_hints
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.rbac import require_tenant_admin
from weave_backend.routers import settings
from weave_backend.schemas.settings import SetModelSettingsRequest
from weave_backend.settings.resolver import ResolvedSetting, SettingNotFound

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _depends_target(route_func: Any) -> Any:
    """The dependency a route's `principal` param resolves through --
    `Annotated[Principal, Depends(...)]` puts it in the annotation metadata,
    not a default value, so wiring is only provable via `get_type_hints`.
    """
    hints = get_type_hints(route_func, include_extras=True)
    return hints["principal"].__metadata__[0].dependency


class TestModelSettingsRouteAuthzWiring:
    def test_get_is_open_to_any_authenticated_tenant_member(self) -> None:
        assert _depends_target(settings.get_model_settings_route) is get_current_principal

    def test_put_is_gated_to_tenant_admins(self) -> None:
        assert _depends_target(settings.set_model_settings_route) is require_tenant_admin


class TestGetModelSettingsRoute:
    async def test_returns_both_tiers_with_defaults_when_nothing_overridden(self) -> None:
        with (
            patch("weave_backend.routers.settings.tenant_connection", _fake_tenant_connection),
            patch(
                "weave_backend.routers.settings.resolve_setting",
                AsyncMock(side_effect=SettingNotFound("platform.models.fable.selected")),
            ),
        ):
            result = await settings.get_model_settings_route(_PRINCIPAL)

        assert result.tiers["fable"].selected == "claude-fable-5"
        assert result.tiers["sonnet"].selected == "claude-sonnet-5"
        assert set(result.tiers["fable"].allowed) == {"claude-fable-5", "claude-sonnet-5"}
        assert set(result.tiers["sonnet"].allowed) == {"claude-fable-5", "claude-sonnet-5"}

    async def test_returns_a_persisted_override_for_one_tier(self) -> None:
        async def _resolve(
            _conn: object, *, tenant_id: str, key: str, context_iri: str
        ) -> ResolvedSetting:
            if key == "platform.models.sonnet.selected":
                return ResolvedSetting(
                    key=key,
                    value="claude-sonnet-5",
                    resolved_at="company",
                    resolved_from_iri=context_iri,
                )
            raise SettingNotFound(key)

        with (
            patch("weave_backend.routers.settings.tenant_connection", _fake_tenant_connection),
            patch("weave_backend.routers.settings.resolve_setting", _resolve),
        ):
            result = await settings.get_model_settings_route(_PRINCIPAL)

        assert result.tiers["sonnet"].selected == "claude-sonnet-5"
        assert result.tiers["fable"].selected == "claude-fable-5"


class TestPutModelSettingsRoute:
    async def test_valid_selection_persists_and_returns_the_refreshed_tiers(self) -> None:
        set_setting_mock = AsyncMock(return_value=None)
        body = SetModelSettingsRequest(tier="fable", model="claude-fable-5")

        with (
            patch("weave_backend.routers.settings.tenant_connection", _fake_tenant_connection),
            patch("weave_backend.routers.settings.set_setting", set_setting_mock),
            patch(
                "weave_backend.routers.settings.resolve_setting",
                AsyncMock(side_effect=SettingNotFound("platform.models.fable.selected")),
            ),
        ):
            result = await settings.set_model_settings_route(body, _PRINCIPAL)

        set_setting_mock.assert_awaited_once()
        call_kwargs = set_setting_mock.await_args.kwargs if set_setting_mock.await_args else {}
        assert call_kwargs["key"] == "platform.models.fable.selected"
        assert call_kwargs["value"] == "claude-fable-5"
        assert call_kwargs["scope_iri"] == "urn:weave:tenant:t1:company"
        assert result.tiers["fable"].selected == "claude-fable-5"

    async def test_a_model_outside_the_allow_list_is_rejected_as_422_not_silent(self) -> None:
        body = SetModelSettingsRequest(tier="sonnet", model="gpt-99-turbo")

        with pytest.raises(HTTPException) as exc_info:
            await settings.set_model_settings_route(body, _PRINCIPAL)

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error"] == "model_not_allowed"  # type: ignore[index]

    async def test_an_unknown_tier_is_rejected_as_422(self) -> None:
        body = SetModelSettingsRequest(tier="ultra", model="claude-fable-5")

        with pytest.raises(HTTPException) as exc_info:
            await settings.set_model_settings_route(body, _PRINCIPAL)

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error"] == "unknown_tier"  # type: ignore[index]

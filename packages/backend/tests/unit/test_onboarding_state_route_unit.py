"""T8 unit test: `GET /onboarding/state` exposes `available_exercises`
(computed via `gate_exercise`) -- direct-call pattern (`tenant_connection`/
store/`resolve_setting` collaborators patched, no docker/Postgres needed),
mirrors `test_onboarding_exercise_check_route_unit.py`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

from weave_backend.auth.dependencies import Principal
from weave_backend.onboarding.store import OnboardingStateRecord
from weave_backend.routers.onboarding import get_state_route
from weave_backend.settings.resolver import SettingNotFound

_PRINCIPAL = Principal(
    sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1"
)


def _state(*, role_path: str = "technical", path_variant: str = "default") -> OnboardingStateRecord:
    return OnboardingStateRecord(
        role_path=role_path,  # type: ignore[arg-type]
        path_variant=path_variant,  # type: ignore[arg-type]
        path_chosen_manually=True,
        checklist_dismissed_at=None,
        checklist_completed_at=None,
        whats_new_seen_at=None,
        tours=[],
        dismissals=[],
        exercise_completions=[],
        activations=[],
        sandbox_workspace_id=None,
        sandbox_forked_at=None,
        sandbox_batch_semver=None,
    )


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_state_route_exposes_available_exercises_for_technical_default() -> None:
    with (
        patch("weave_backend.routers.onboarding.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.onboarding.store.get_state",
            AsyncMock(return_value=_state(role_path="technical", path_variant="default")),
        ),
        patch(
            "weave_backend.routers.onboarding.resolve_setting",
            AsyncMock(side_effect=SettingNotFound("k")),
        ),
    ):
        result = await get_state_route(_PRINCIPAL)

    assert "CE-03" in result.available_exercises
    assert "CE-03b" not in result.available_exercises


async def test_state_route_excludes_write_exercise_for_read_only_variant() -> None:
    with (
        patch("weave_backend.routers.onboarding.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.onboarding.store.get_state",
            AsyncMock(return_value=_state(role_path="business", path_variant="read_only")),
        ),
        patch(
            "weave_backend.routers.onboarding.resolve_setting",
            AsyncMock(side_effect=SettingNotFound("k")),
        ),
    ):
        result = await get_state_route(_PRINCIPAL)

    assert "CE-02" not in result.available_exercises

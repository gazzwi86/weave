"""ONB-TASK-009 unit tests: `routers/onboarding.py::check_exercise_route`
direct-call pattern (`tenant_connection`/store collaborators patched, no
docker/Postgres needed) -- mirrors `test_project_pin_router.py`. Covers the
route wiring itself (404 unknown exercise, 403 gated, 200 verified+persist,
200 not-verified-no-write) without the segfault-prone `platform_stack` +
coverage-instrumentation combo the docker integration path hits in this
environment; `test_onboarding_exercise_check_route.py` covers the real-DB
round trip.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.onboarding.exercise_checker import UnsupportedCompletionKindError
from weave_backend.onboarding.store import ExerciseCompletionRecord, OnboardingStateRecord
from weave_backend.routers.onboarding import check_exercise_route
from weave_backend.schemas.onboarding import ExerciseCheckRequest

_PRINCIPAL = Principal(
    sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1"
)


def _state(
    *,
    role_path: str = "technical",
    path_variant: str = "default",
    completions: list[ExerciseCompletionRecord] | None = None,
) -> OnboardingStateRecord:
    return OnboardingStateRecord(
        role_path=role_path,  # type: ignore[arg-type]
        path_variant=path_variant,  # type: ignore[arg-type]
        path_chosen_manually=True,
        checklist_dismissed_at=None,
        checklist_completed_at=None,
        whats_new_seen_at=None,
        tours=[],
        dismissals=[],
        exercise_completions=completions or [],
        activations=[],
        sandbox_workspace_id=None,
        sandbox_forked_at=None,
    )


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_check_route_returns_404_for_unknown_exercise() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await check_exercise_route(
            "NOT-REAL", ExerciseCheckRequest(signals=[]), _PRINCIPAL
        )
    assert exc_info.value.status_code == 404


async def test_check_route_returns_403_when_gated() -> None:
    with (
        patch("weave_backend.routers.onboarding.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.onboarding.store.get_state",
            AsyncMock(return_value=_state(role_path="business")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await check_exercise_route("CE-03", ExerciseCheckRequest(signals=[]), _PRINCIPAL)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {"error": "path_gated"}  # type: ignore[comparison-overlap]


async def test_check_route_verifies_and_persists_nav_signal() -> None:
    completed_at = datetime(2026, 1, 1, tzinfo=UTC)
    refreshed = _state(
        completions=[
            ExerciseCompletionRecord(
                exercise_id="CE-01", verified_signal="nav_signal", completed_at=completed_at
            )
        ]
    )
    record_mock = AsyncMock()
    with (
        patch("weave_backend.routers.onboarding.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.onboarding.store.get_state",
            AsyncMock(side_effect=[_state(), refreshed]),
        ),
        patch(
            "weave_backend.routers.onboarding.store.record_exercise_completion_with_retry",
            record_mock,
        ),
    ):
        result = await check_exercise_route(
            "CE-01",
            ExerciseCheckRequest(signals=["entity-list-viewed", "missing-property-viewed"]),
            _PRINCIPAL,
        )

    assert result.verified is True
    assert result.verified_signal == "nav_signal"
    assert result.completed_at == completed_at
    record_mock.assert_awaited_once()


async def test_check_route_returns_422_for_unsupported_completion_kind() -> None:
    with (
        patch("weave_backend.routers.onboarding.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.onboarding.store.get_state",
            AsyncMock(return_value=_state()),
        ),
        patch(
            "weave_backend.routers.onboarding.check_completion",
            AsyncMock(side_effect=UnsupportedCompletionKindError("write_commit")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await check_exercise_route(
            "CE-01", ExerciseCheckRequest(signals=[]), _PRINCIPAL
        )
    assert exc_info.value.status_code == 422


async def test_check_route_returns_unverified_without_persisting() -> None:
    record_mock = AsyncMock()
    with (
        patch("weave_backend.routers.onboarding.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.onboarding.store.get_state",
            AsyncMock(return_value=_state()),
        ),
        patch(
            "weave_backend.routers.onboarding.store.record_exercise_completion_with_retry",
            record_mock,
        ),
    ):
        result = await check_exercise_route(
            "CE-01", ExerciseCheckRequest(signals=["entity-list-viewed"]), _PRINCIPAL
        )

    assert result.verified is False
    record_mock.assert_not_awaited()

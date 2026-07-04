"""AC-2/AC-6: pre-call budget gate + cap-utilisation notification, against
mocked `resolve_setting`/`dispatch_notification` (no real Postgres) and a
hand-written fake Redis (fakeredis isn't installed in this repo -- see
`test_notifications_dispatch.py` for the same mocking convention).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.billing.gate import BillingScope, BudgetCapReached, enforce_budget
from weave_backend.settings.resolver import ResolvedSetting, SettingNotFound

_TENANT = "acme-corp"
_WORKSPACE = "11111111-1111-1111-1111-111111111111"
_SCOPE = BillingScope(_TENANT, _WORKSPACE)


class _FakeRedis:
    """ponytail: hand-written in-memory stand-in -- fakeredis isn't an
    installed dependency in this repo. Only the two calls `gate.py` makes.
    """

    def __init__(self, values: dict[str, float] | None = None) -> None:
        self._values = values or {}

    async def get(self, key: str) -> bytes | None:
        if key not in self._values:
            return None
        return str(self._values[key]).encode()


def _redis(values: dict[str, float] | None = None) -> Any:
    """Typed `Any` -- `redis.asyncio.Redis` ships real stubs (unlike
    asyncpg), so mypy strict rejects a hand-written fake against it by
    structural type; this is a deliberate test double, not a type escape.
    """
    return _FakeRedis(values)


def _cap(value: float) -> ResolvedSetting:
    return ResolvedSetting(
        key="ai.budget.per_period_usd", value=value, resolved_at="workspace", resolved_from_iri="x"
    )


def _patched(
    resolved: ResolvedSetting | Exception, admin_subs: list[str]
) -> tuple[Any, AsyncMock]:
    resolve_mock = AsyncMock(side_effect=resolved if isinstance(resolved, Exception) else None)
    if not isinstance(resolved, Exception):
        resolve_mock.return_value = resolved
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[{"user_sub": sub} for sub in admin_subs])
    return conn, resolve_mock


async def test_enforce_budget_allows_call_under_cap() -> None:
    conn, resolve_mock = _patched(_cap(100.0), admin_subs=[])
    redis = _redis({f"billing:{_TENANT}:{_WORKSPACE}:2026-07:consumed_usd": 10.0})

    with (
        patch("weave_backend.billing.gate.resolve_setting", resolve_mock),
        patch("weave_backend.billing.gate.current_period", return_value="2026-07"),
    ):
        await enforce_budget(conn, redis, _SCOPE)

    conn.fetch.assert_not_awaited()


async def test_enforce_budget_rejects_when_consumed_equals_cap() -> None:
    """AC-2: `consumed >= cap` rejects at exactly 100%, not only when over."""
    conn, resolve_mock = _patched(_cap(100.0), admin_subs=["u-admin"])
    redis = _redis({f"billing:{_TENANT}:{_WORKSPACE}:2026-07:consumed_usd": 100.0})

    with (
        patch("weave_backend.billing.gate.resolve_setting", resolve_mock),
        patch("weave_backend.billing.gate.current_period", return_value="2026-07"),
        patch("weave_backend.billing.gate.dispatch_notification", AsyncMock()) as notify_mock,
        pytest.raises(BudgetCapReached) as exc_info,
    ):
        await enforce_budget(conn, redis, _SCOPE)

    assert exc_info.value.effective_cap_usd == 100.0
    assert exc_info.value.consumed_usd == 100.0
    notify_mock.assert_awaited_once()
    assert notify_mock.call_args.args[1].event_type == "billing.cap.reached"


async def test_enforce_budget_no_cap_configured_allows_call() -> None:
    """ADR-009: no cap anywhere in the cascade is unmetered / fail-open."""
    conn, resolve_mock = _patched(SettingNotFound("ai.budget.per_period_usd"), admin_subs=[])
    redis = _redis()

    with patch("weave_backend.billing.gate.resolve_setting", resolve_mock):
        await enforce_budget(conn, redis, _SCOPE)

    conn.fetch.assert_not_awaited()


async def test_enforce_budget_dispatches_warning_at_80_percent() -> None:
    conn, resolve_mock = _patched(_cap(100.0), admin_subs=["u-admin"])
    redis = _redis({f"billing:{_TENANT}:{_WORKSPACE}:2026-07:consumed_usd": 80.0})

    with (
        patch("weave_backend.billing.gate.resolve_setting", resolve_mock),
        patch("weave_backend.billing.gate.current_period", return_value="2026-07"),
        patch("weave_backend.billing.gate.dispatch_notification", AsyncMock()) as notify_mock,
    ):
        await enforce_budget(conn, redis, _SCOPE)

    notify_mock.assert_awaited_once()
    assert notify_mock.call_args.args[1].event_type == "billing.cap.warning"


async def test_enforce_budget_below_warning_threshold_does_not_notify() -> None:
    conn, resolve_mock = _patched(_cap(100.0), admin_subs=["u-admin"])
    redis = _redis({f"billing:{_TENANT}:{_WORKSPACE}:2026-07:consumed_usd": 50.0})

    with (
        patch("weave_backend.billing.gate.resolve_setting", resolve_mock),
        patch("weave_backend.billing.gate.current_period", return_value="2026-07"),
        patch("weave_backend.billing.gate.dispatch_notification", AsyncMock()) as notify_mock,
    ):
        await enforce_budget(conn, redis, _SCOPE)

    notify_mock.assert_not_awaited()

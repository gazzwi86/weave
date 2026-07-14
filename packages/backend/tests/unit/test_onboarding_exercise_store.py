"""TASK-009 AC-009-04/05: `record_exercise_completion_with_retry` upserts
`exercise_completion` and retries once on a transient write failure,
without losing whatever was already persisted.
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.onboarding import store

_TENANT = "acme-corp"
_USER = "urn:weave:principal:user:u-1"


class _FlakyConnection:
    """Fails `execute` `fail_times` times before succeeding."""

    def __init__(self, fail_times: int = 0) -> None:
        self.fail_times = fail_times
        self.calls = 0
        self.rows: dict[str, dict[str, Any]] = {}

    async def execute(self, query: str, *args: Any) -> str:
        self.calls += 1
        if self.calls <= self.fail_times:
            raise ConnectionError("transient write failure")
        assert "INSERT INTO exercise_completion" in query
        tenant_id, user_id, exercise_id, verified_signal = args
        self.rows[exercise_id] = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "exercise_id": exercise_id,
            "verified_signal": verified_signal,
        }
        return "INSERT 1"


async def test_record_exercise_completion_upserts_on_first_success() -> None:
    conn = _FlakyConnection(fail_times=0)
    await store.record_exercise_completion_with_retry(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        exercise_id="CE-01",
        verified_signal="nav_signal",
    )
    assert conn.rows["CE-01"]["verified_signal"] == "nav_signal"
    assert conn.calls == 1


async def test_record_exercise_completion_retries_once_then_succeeds() -> None:
    conn = _FlakyConnection(fail_times=1)
    await store.record_exercise_completion_with_retry(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        exercise_id="CE-02",
        verified_signal="ask",
    )
    assert conn.rows["CE-02"]["verified_signal"] == "ask"
    assert conn.calls == 2


async def test_record_exercise_completion_raises_after_exhausting_retries() -> None:
    conn = _FlakyConnection(fail_times=5)
    with pytest.raises(ConnectionError):
        await store.record_exercise_completion_with_retry(
            conn,
            tenant_id=_TENANT,
            user_id=_USER,
            exercise_id="CE-03",
            verified_signal="ask",
        )
    assert conn.rows == {}

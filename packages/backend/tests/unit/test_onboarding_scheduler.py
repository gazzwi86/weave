"""ONB-TASK-011 unit tests: the recurring scheduler entrypoint that actually
invokes `poller.select_pollable_users`/`poll_user` (grep-call-site proof
that AC-011-06's "poll interval default 60s" isn't dead code).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import pytest

from weave_backend.onboarding import scheduler
from weave_backend.onboarding.poller import DEFAULT_POLL_INTERVAL_SECONDS, PollableUser

_TENANT_A = "acme-corp"
_TENANT_B = "globex"


@dataclass
class _FakeConn:
    tenant_id: str


def _patch_tenants_and_users(
    monkeypatch: pytest.MonkeyPatch, users_by_tenant: dict[str, list[PollableUser]]
) -> tuple[list[str], list[tuple[str, str]]]:
    """Returns (tenant_ids_queried, (tenant_id, user_id) pairs poll_user was
    called for), and stubs out both connection context managers so no real
    Postgres is touched.
    """
    polled: list[tuple[str, str]] = []

    class _Ctx:
        def __init__(self, conn: _FakeConn) -> None:
            self._conn = conn

        async def __aenter__(self) -> _FakeConn:
            return self._conn

        async def __aexit__(self, *exc: object) -> None:
            return None

    def _untenanted_connection() -> _Ctx:
        return _Ctx(_FakeConn(tenant_id="__untenanted__"))

    def _tenant_connection(tenant_id: str) -> _Ctx:
        return _Ctx(_FakeConn(tenant_id=tenant_id))

    async def _distinct_tenant_ids(conn: _FakeConn) -> list[str]:
        return list(users_by_tenant.keys())

    async def _select_pollable_users(conn: _FakeConn, tenant_id: str) -> list[PollableUser]:
        return users_by_tenant.get(tenant_id, [])

    async def _poll_user(conn: _FakeConn, user: PollableUser) -> None:
        polled.append((conn.tenant_id, user.user_id))

    monkeypatch.setattr(scheduler, "untenanted_connection", _untenanted_connection)
    monkeypatch.setattr(scheduler, "tenant_connection", _tenant_connection)
    monkeypatch.setattr(scheduler, "_fetch_tenant_ids", _distinct_tenant_ids)
    monkeypatch.setattr(scheduler, "select_pollable_users", _select_pollable_users)
    monkeypatch.setattr(scheduler, "poll_user", _poll_user)

    return list(users_by_tenant.keys()), polled


def _user(tenant_id: str, user_id: str) -> PollableUser:
    return PollableUser(
        tenant_id=tenant_id, user_id=user_id, user_sub="u", role_path="business", cursor=None
    )


async def test_poll_all_tenants_polls_every_user_in_every_tenant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tenant_ids, polled = _patch_tenants_and_users(
        monkeypatch,
        {
            _TENANT_A: [_user(_TENANT_A, "u-1"), _user(_TENANT_A, "u-2")],
            _TENANT_B: [_user(_TENANT_B, "u-3")],
        },
    )

    await scheduler._poll_all_tenants()

    assert tenant_ids == [_TENANT_A, _TENANT_B]
    assert polled == [
        (_TENANT_A, "u-1"),
        (_TENANT_A, "u-2"),
        (_TENANT_B, "u-3"),
    ]


async def test_poll_all_tenants_skips_tenant_with_no_pollable_users(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, polled = _patch_tenants_and_users(monkeypatch, {_TENANT_A: []})

    await scheduler._poll_all_tenants()

    assert polled == []


async def test_run_forever_sleeps_the_default_interval_between_cycles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_tenants_and_users(monkeypatch, {})
    sleeps: list[float] = []

    async def _sleep(seconds: float) -> None:
        sleeps.append(seconds)
        raise asyncio.CancelledError  # stop the loop after one cycle

    monkeypatch.setattr(asyncio, "sleep", _sleep)

    with pytest.raises(asyncio.CancelledError):
        await scheduler._run_forever()

    assert sleeps == [DEFAULT_POLL_INTERVAL_SECONDS]


async def test_run_forever_survives_a_cycle_that_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _boom() -> None:
        raise RuntimeError("db down")

    monkeypatch.setattr(scheduler, "_poll_all_tenants", _boom)

    async def _sleep(seconds: float) -> None:
        raise asyncio.CancelledError

    monkeypatch.setattr(asyncio, "sleep", _sleep)

    with pytest.raises(asyncio.CancelledError):
        await scheduler._run_forever()  # the exception from _boom must not propagate


def _patch_tenants_and_flush(
    monkeypatch: pytest.MonkeyPatch, tenant_ids: list[str]
) -> list[str]:
    """Same fake connection plumbing as `_patch_tenants_and_users`, for the
    dispatcher's `_flush_all_tenants` loop instead of the poller's.
    """
    flushed: list[str] = []

    class _Ctx:
        def __init__(self, conn: _FakeConn) -> None:
            self._conn = conn

        async def __aenter__(self) -> _FakeConn:
            return self._conn

        async def __aexit__(self, *exc: object) -> None:
            return None

    async def _distinct_tenant_ids(conn: _FakeConn) -> list[str]:
        return tenant_ids

    async def _flush_pending(conn: _FakeConn, tenant_id: str) -> int:
        flushed.append(tenant_id)
        return 0

    monkeypatch.setattr(
        scheduler, "untenanted_connection", lambda: _Ctx(_FakeConn(tenant_id="__u__"))
    )
    monkeypatch.setattr(
        scheduler,
        "tenant_connection",
        lambda tenant_id: _Ctx(_FakeConn(tenant_id=tenant_id)),
    )
    monkeypatch.setattr(scheduler, "_fetch_tenant_ids", _distinct_tenant_ids)
    monkeypatch.setattr(scheduler, "flush_pending", _flush_pending)
    return flushed


async def test_flush_all_tenants_drains_every_tenants_outbox(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    flushed = _patch_tenants_and_flush(monkeypatch, [_TENANT_A, _TENANT_B])

    await scheduler._flush_all_tenants()

    assert flushed == [_TENANT_A, _TENANT_B]


async def test_dispatch_run_forever_sleeps_the_dispatch_interval(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_tenants_and_flush(monkeypatch, [])
    sleeps: list[float] = []

    async def _sleep(seconds: float) -> None:
        sleeps.append(seconds)
        raise asyncio.CancelledError

    monkeypatch.setattr(asyncio, "sleep", _sleep)

    with pytest.raises(asyncio.CancelledError):
        await scheduler._dispatch_run_forever()

    assert sleeps == [scheduler.DISPATCH_INTERVAL_SECONDS]


async def test_dispatch_run_forever_survives_a_cycle_that_raises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _boom() -> None:
        raise RuntimeError("db down")

    monkeypatch.setattr(scheduler, "_flush_all_tenants", _boom)

    async def _sleep(seconds: float) -> None:
        raise asyncio.CancelledError

    monkeypatch.setattr(asyncio, "sleep", _sleep)

    with pytest.raises(asyncio.CancelledError):
        await scheduler._dispatch_run_forever()


async def test_spawn_dispatcher_adds_and_discards_the_task(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ran = asyncio.Event()

    async def _fake_dispatch_run_forever() -> None:
        ran.set()

    monkeypatch.setattr(scheduler, "_dispatch_run_forever", _fake_dispatch_run_forever)

    task = scheduler.spawn_dispatcher()
    assert task in scheduler._background_tasks

    await ran.wait()
    await task
    await asyncio.sleep(0)

    assert task not in scheduler._background_tasks


async def test_spawn_scheduler_adds_and_discards_the_task(monkeypatch: pytest.MonkeyPatch) -> None:
    """Real lifecycle proof for the strong-ref-set pattern: `spawn_scheduler`
    must hold the task in `_background_tasks` while it runs and release it
    on completion -- the CPython weak-ref-GC gotcha `metering.py` guards
    against.
    """
    ran = asyncio.Event()

    async def _fake_run_forever() -> None:
        ran.set()

    monkeypatch.setattr(scheduler, "_run_forever", _fake_run_forever)

    task = scheduler.spawn_scheduler()
    assert task in scheduler._background_tasks

    await ran.wait()
    await task
    await asyncio.sleep(0)  # done-callbacks fire via call_soon, one tick later

    assert task not in scheduler._background_tasks

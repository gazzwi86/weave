"""ONB-TASK-011 unit tests: activation poller (ADR-004). Cursor rules,
CE-outage skip, locked-milestone skip, own-workspace-only, and the
stop-condition query shape. `record_milestone`/CE-signal calls are
monkeypatched so control flow is provable without a real Postgres or
Oxigraph connection -- the real ON CONFLICT race and PROV signal are
covered by the docker integration suite.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest

from weave_backend.onboarding import poller
from weave_backend.operations.versioning import VersionNotFound
from weave_backend.tenancy.workspaces import Workspace

_TENANT = "acme-corp"
_USER_SUB = "u-1"
_USER_IRI = "urn:weave:principal:user:u-1"
_WORKSPACE_ID = "ws-1"
_NAMED_GRAPH = "urn:weave:tenant:acme-corp:ws:ws-1"


def _user(role_path: str = "business", cursor: str | None = None) -> poller.PollableUser:
    return poller.PollableUser(
        tenant_id=_TENANT, user_id=_USER_IRI, user_sub=_USER_SUB, role_path=role_path, cursor=cursor
    )


@dataclass
class _FakeConn:
    executed: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


def _patch_ce(
    monkeypatch: pytest.MonkeyPatch,
    *,
    active_workspace: str | None = _WORKSPACE_ID,
    workspace: Workspace | None = None,
    latest_version: str | Exception = "v0.2.0",
    fired: bool | Exception = False,
) -> list[str]:
    calls: list[str] = []

    async def _get_active_workspace(tenant_id: str, user_sub: str) -> str | None:
        calls.append("get_active_workspace")
        return active_workspace

    async def _get_workspace(conn: Any, *, tenant_id: str, workspace_id: str) -> Workspace | None:
        calls.append("get_workspace")
        return workspace or Workspace(
            id=_WORKSPACE_ID,
            slug="ws-1",
            display_name="Workspace 1",
            named_graph_iri=_NAMED_GRAPH,
            created_at=datetime.now(UTC),
        )

    async def _resolve_version(
        conn: Any, *, tenant_id: str, workspace_id: str, version: str
    ) -> str:
        calls.append("resolve_version")
        if isinstance(latest_version, Exception):
            raise latest_version
        return latest_version

    async def _has_committed_entity(named_graph_iri: str, principal_iri: str) -> bool:
        calls.append("has_committed_entity")
        if isinstance(fired, Exception):
            raise fired
        return fired

    recorded: list[dict[str, Any]] = []

    async def _record_milestone(conn: Any, **kwargs: Any) -> bool:
        calls.append("record_milestone")
        recorded.append(kwargs)
        return True

    monkeypatch.setattr(poller, "get_active_workspace", _get_active_workspace)
    monkeypatch.setattr(poller, "get_workspace", _get_workspace)
    monkeypatch.setattr(poller, "resolve_version", _resolve_version)
    monkeypatch.setattr(poller, "has_committed_entity", _has_committed_entity)
    monkeypatch.setattr(poller, "record_milestone", _record_milestone)
    return calls


async def test_poll_user_no_version_advance_skips_signal_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-011-01: cursor unchanged -> milestone check never runs."""
    calls = _patch_ce(monkeypatch, latest_version="v0.1.0")
    conn = _FakeConn()

    await poller.poll_user(conn, _user(cursor="v0.1.0"))

    assert "has_committed_entity" not in calls
    assert conn.executed == []  # cursor already current -- no write needed


async def test_poll_user_advance_and_signal_found_records_milestone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _patch_ce(monkeypatch, latest_version="v0.2.0", fired=True)
    conn = _FakeConn()

    await poller.poll_user(conn, _user(cursor="v0.1.0"))

    assert "record_milestone" in calls
    assert len(conn.executed) == 1  # cursor advanced
    assert conn.executed[0][1][-1] == "v0.2.0"


async def test_poll_user_advance_no_signal_advances_cursor_without_recording(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _patch_ce(monkeypatch, latest_version="v0.2.0", fired=False)
    conn = _FakeConn()

    await poller.poll_user(conn, _user(cursor="v0.1.0"))

    assert "record_milestone" not in calls
    assert len(conn.executed) == 1  # cursor still advances (completed cycle)


async def test_poll_user_no_published_version_skips_without_moving_cursor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_ce(monkeypatch, latest_version=VersionNotFound("latest"))
    conn = _FakeConn()

    await poller.poll_user(conn, _user(cursor=None))

    assert conn.executed == []


async def test_poll_user_ce_outage_mid_cycle_skips_without_moving_cursor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-011-05: CE unreachable mid-cycle -> skip the cycle, cursor untouched."""
    _patch_ce(monkeypatch, latest_version="v0.2.0", fired=httpx.ConnectError("down"))
    conn = _FakeConn()

    await poller.poll_user(conn, _user(cursor="v0.1.0"))

    assert conn.executed == []


async def test_poll_user_locked_milestone_never_evaluated(monkeypatch: pytest.MonkeyPatch) -> None:
    """AC-011-05: compliance has no detector milestone in this slice -- never
    even resolves the active workspace, let alone queries CE.
    """
    calls = _patch_ce(monkeypatch)

    await poller.poll_user(_FakeConn(), _user(role_path="compliance"))

    assert calls == []


async def test_poll_user_no_active_workspace_skips(monkeypatch: pytest.MonkeyPatch) -> None:
    """AC-011-07 corollary: no active own-workspace session -> nothing to check."""
    calls = _patch_ce(monkeypatch, active_workspace=None)
    conn = _FakeConn()

    await poller.poll_user(conn, _user(cursor="v0.1.0"))

    assert "resolve_version" not in calls
    assert conn.executed == []


class _FakeSelectConn:
    def __init__(self) -> None:
        self.query: str | None = None
        self.args: tuple[Any, ...] = ()

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        self.query = query
        self.args = args
        return []


async def test_select_pollable_users_scopes_to_demo_active_unfired_business_technical() -> None:
    """AC-011-06: query shape proves the stop condition (anti-join against
    `activation`) and the demo-active filter (`sandbox_forked_at`).
    """
    conn = _FakeSelectConn()

    await poller.select_pollable_users(conn, _TENANT)

    assert conn.args == (_TENANT,)
    query = conn.query
    assert query is not None
    assert "sandbox_forked_at IS NOT NULL" in query
    assert "NOT EXISTS" in query
    assert "role_path IN ('business', 'technical')" in query

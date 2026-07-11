"""TASK-030 AC-1: `list_for_workspace` -- the store function backing
`GET /api/workspaces/{workspace_id}/members`. Uses a stub asyncpg
connection (no real Postgres), same pattern as `test_tenancy_workspaces.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.tenancy.members import list_for_workspace

_INVITED_AT = datetime(2026, 7, 1, tzinfo=UTC)


class _FakeConnection:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        self.calls.append((query, args))
        return self.rows


async def test_list_for_workspace_prefers_principal_display_name() -> None:
    conn = _FakeConnection(
        [
            {
                "user_sub": "u-1",
                "email": "active@acme-corp.example",
                "role": "workspace_admin",
                "status": "active",
                "invited_at": _INVITED_AT,
                "display_name": "Ada Lovelace",
            }
        ]
    )

    members = await list_for_workspace(conn, tenant_id="acme-corp", workspace_id="ws-1")

    assert members[0].display_name == "Ada Lovelace"
    assert members[0].user_sub == "u-1"
    assert conn.calls[0][1] == ("acme-corp", "ws-1")


async def test_list_for_workspace_falls_back_to_email_for_pending_invite() -> None:
    """A pending invite has no principal row yet (never signed in) -- no
    `display_name` to join, so the member's own email stands in.
    """
    conn = _FakeConnection(
        [
            {
                "user_sub": None,
                "email": "pending@acme-corp.example",
                "role": "engineer",
                "status": "pending",
                "invited_at": _INVITED_AT,
                "display_name": None,
            }
        ]
    )

    members = await list_for_workspace(conn, tenant_id="acme-corp", workspace_id="ws-1")

    assert members[0].display_name == "pending@acme-corp.example"
    assert members[0].user_sub is None

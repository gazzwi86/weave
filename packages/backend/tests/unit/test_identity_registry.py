"""PLAT-TASK-004 AC-1/AC-2/AC-6: principal minting is deterministic and its
only DB interaction is a single upsert/select (`execute`/`fetchrow`/`fetch`),
all trivially fakeable -- stays a true unit test (no real Postgres), matching
`test_tenancy_workspaces.py`'s `_FakeConnection` precedent.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from weave_backend.identity.registry import (
    PrincipalNotFound,
    agent_principal_iri,
    ensure_agent_principal,
    ensure_human_principal,
    get_principal,
    human_principal_iri,
)

_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111"
_AGENT_ARN = "arn:aws:iam::123456789012:role/weave-agent"


class _FakeConnection:
    """Records every `execute` call's SQL + args; `fetchrow`/`fetch` return
    whatever the test pre-loads onto `principal_row`/`membership_rows`.
    """

    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self.principal_row: dict[str, Any] | None = None
        self.membership_rows: list[dict[str, Any]] = []

    async def execute(self, query: str, *args: Any) -> str:
        self.executed.append((query, args))
        return "INSERT 0 1"

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        return self.principal_row

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        return self.membership_rows


async def test_human_principal_iri_is_deterministic() -> None:
    assert human_principal_iri("u1") == "urn:weave:principal:user:u1"
    assert human_principal_iri("u1") == human_principal_iri("u1")


async def test_principal_iri_minted_idempotent() -> None:
    """AC-1: the same (tenant_id, sub) mints the same IRI on every login, and
    a second mint is an upsert (no duplicate-key crash on the second call).
    """
    conn = _FakeConnection()

    first = await ensure_human_principal(conn, tenant_id="acme", sub="u1", display_name="u1")
    second = await ensure_human_principal(conn, tenant_id="acme", sub="u1", display_name="u1")

    assert first == second == "urn:weave:principal:user:u1"
    assert len(conn.executed) == 2
    assert "ON CONFLICT" in conn.executed[0][0]


async def test_agent_principal_iri_derived_from_role_arn_hash() -> None:
    iri = agent_principal_iri(_AGENT_ARN)
    assert iri.startswith("urn:weave:principal:agent:")
    assert len(iri.removeprefix("urn:weave:principal:agent:")) == 16
    assert iri == agent_principal_iri(_AGENT_ARN)  # deterministic


async def test_ensure_agent_principal_upserts_registry_row() -> None:
    conn = _FakeConnection()

    iri = await ensure_agent_principal(
        conn,
        tenant_id="acme",
        workspace_id=_WORKSPACE_ID,
        iam_role_arn=_AGENT_ARN,
        display_name="weave-agent",
    )

    assert iri == agent_principal_iri(_AGENT_ARN)
    assert "ON CONFLICT" in conn.executed[0][0]


async def test_principal_lookup_by_iri() -> None:
    """AC-6 unit slice: `get_principal` joins the principal row with its
    active workspace memberships.
    """
    conn = _FakeConnection()
    conn.principal_row = {
        "iri": "urn:weave:principal:user:u1",
        "type": "human",
        "sub": "u1",
        "display_name": "u1",
        "created_at": datetime.now(UTC),
    }
    conn.membership_rows = [{"workspace_id": _WORKSPACE_ID, "role": "admin"}]

    record = await get_principal(conn, tenant_id="acme", iri="urn:weave:principal:user:u1")

    assert record.iri == "urn:weave:principal:user:u1"
    assert record.type == "human"
    assert len(record.workspace_memberships) == 1
    assert record.workspace_memberships[0].workspace_id == _WORKSPACE_ID
    assert record.workspace_memberships[0].role == "admin"


async def test_principal_lookup_raises_not_found_for_missing_iri() -> None:
    conn = _FakeConnection()
    conn.principal_row = None

    with pytest.raises(PrincipalNotFound):
        await get_principal(conn, tenant_id="acme", iri="urn:weave:principal:user:ghost")

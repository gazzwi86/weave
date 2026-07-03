"""PLAT-TASK-004 AC-3: `ROLE_RANK` is the single authoritative role
hierarchy; `check_role` is the pure decision function both the workspace and
tenant-admin dependencies call through -- a true unit test needs no real
Postgres, only a fake `workspace_members` row (`_FakeConnection`, matching
the rest of this suite's precedent).
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.rbac import (
    ROLE_RANK,
    InsufficientRole,
    check_role,
    enforce_workspace_role,
    is_tenant_admin,
    resolve_workspace_role,
)

_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111"


class _FakeConnection:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        return self._row


def test_role_rank_order_is_authoritative() -> None:
    assert ROLE_RANK == {"read": 0, "author": 1, "publish": 2, "admin": 3}


def test_check_role_allows_equal_or_higher_role() -> None:
    check_role("admin", "admin")
    check_role("publish", "author")  # higher rank satisfies a lower requirement


def test_rbac_insufficient_role_returns_403() -> None:
    with pytest.raises(InsufficientRole) as exc_info:
        check_role("author", "admin")

    assert exc_info.value.status_code == 403
    # Starlette types HTTPException.detail as `str | None`; InsufficientRole
    # deliberately passes a dict (the exact 403 body AC-3 specifies).
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "forbidden",
        "required_role": "admin",
    }


def test_check_role_rejects_missing_or_unrecognised_role() -> None:
    with pytest.raises(InsufficientRole):
        check_role(None, "read")
    with pytest.raises(InsufficientRole):
        check_role("not-a-real-role", "read")


async def test_resolve_workspace_role_returns_none_when_no_active_membership() -> None:
    conn = _FakeConnection(row=None)

    role = await resolve_workspace_role(
        conn, tenant_id="acme", workspace_id=_WORKSPACE_ID, user_sub="u-nobody"
    )

    assert role is None


async def test_resolve_workspace_role_returns_the_active_row_role() -> None:
    conn = _FakeConnection(row={"role": "author"})

    role = await resolve_workspace_role(
        conn, tenant_id="acme", workspace_id=_WORKSPACE_ID, user_sub="u-author"
    )

    assert role == "author"


async def test_is_tenant_admin_true_only_with_an_admin_membership_row() -> None:
    admin_conn = _FakeConnection(row={"1": 1})
    non_admin_conn = _FakeConnection(row=None)

    assert await is_tenant_admin(admin_conn, tenant_id="acme", user_sub="u-admin") is True
    assert await is_tenant_admin(non_admin_conn, tenant_id="acme", user_sub="u-viewer") is False


async def test_enforce_workspace_role_rejects_a_non_member() -> None:
    """QA FAIL (AC-3): settings/sparql routes derive workspace_id from a
    scope IRI, not a path param, so they can't use the
    `require_workspace_role` dependency factory directly -- this is the
    shared check both that factory and those routes call through.
    """
    conn = _FakeConnection(row=None)

    with pytest.raises(InsufficientRole):
        await enforce_workspace_role(
            conn,
            tenant_id="acme",
            workspace_id=_WORKSPACE_ID,
            user_sub="u-outsider",
            min_role="read",
        )


async def test_enforce_workspace_role_allows_a_sufficient_role() -> None:
    conn = _FakeConnection(row={"role": "author"})

    await enforce_workspace_role(
        conn, tenant_id="acme", workspace_id=_WORKSPACE_ID, user_sub="u-author", min_role="read"
    )

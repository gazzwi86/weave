"""AC-2/AC-3: invite, activate (test/dev helper -- see deviation note in the
progress summary; no accept-invite endpoint is in this brief's API contract)
and revoke workspace membership.
"""

from __future__ import annotations

import asyncpg
from pydantic import BaseModel


class MemberAlreadyActive(Exception):
    """Raised when inviting an email that already has an active membership."""


class MemberNotFound(Exception):
    """Raised when an activate/lookup targets a workspace_id+email pair
    with no matching invite row (PR #11 finding 6: `_to_member(None)` on a
    missing `RETURNING` row used to crash with an opaque AttributeError).
    """


class Member(BaseModel):
    id: str
    workspace_id: str
    email: str
    role: str
    status: str
    user_sub: str | None


def _to_member(row: asyncpg.Record) -> Member:
    return Member(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        email=row["email"],
        role=row["role"],
        status=row["status"],
        user_sub=row["user_sub"],
    )


async def invite_member(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, email: str, role: str
) -> Member:
    existing = await conn.fetchrow(
        "SELECT status FROM workspace_members WHERE tenant_id = $1 AND workspace_id = $2"
        " AND email = $3",
        tenant_id,
        workspace_id,
        email,
    )
    if existing is not None and existing["status"] == "active":
        raise MemberAlreadyActive(email)

    row = await conn.fetchrow(
        """
        INSERT INTO workspace_members (tenant_id, workspace_id, email, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tenant_id, workspace_id, email)
        DO UPDATE SET role = EXCLUDED.role
        RETURNING id, workspace_id, email, role, status, user_sub
        """,
        tenant_id,
        workspace_id,
        email,
        role,
    )
    return _to_member(row)


async def activate_member(
    conn: asyncpg.Connection, *, workspace_id: str, email: str, user_sub: str
) -> Member:
    """Marks a pending invite accepted. No accept-invite endpoint exists in
    this brief's API contract (only invite + revoke are specified) -- this
    is the internal seam a later "accept invite" flow calls into, and what
    tests use to set up an "already active" precondition.
    """
    row = await conn.fetchrow(
        """
        UPDATE workspace_members
        SET status = 'active', user_sub = $3, activated_at = now()
        WHERE workspace_id = $1 AND email = $2
        RETURNING id, workspace_id, email, role, status, user_sub
        """,
        workspace_id,
        email,
        user_sub,
    )
    if row is None:
        raise MemberNotFound(f"no invite for {email} in workspace {workspace_id}")
    return _to_member(row)


async def revoke_member(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, user_sub: str
) -> bool:
    """Removes the role binding outright. Returns True if a row was
    actually removed (so the caller only bumps the session version -- and
    emits an audit event -- for a real revocation, not a no-op DELETE).
    """
    result = await conn.execute(
        """
        DELETE FROM workspace_members
        WHERE tenant_id = $1 AND workspace_id = $2 AND user_sub = $3
        """,
        tenant_id,
        workspace_id,
        user_sub,
    )
    return bool(result != "DELETE 0")

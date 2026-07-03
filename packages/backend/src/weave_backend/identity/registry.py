"""AC-1/AC-2/AC-6/AC-7: the principal registry (`migrations/0002_identity.sql`).

`principals.sub` is the single RBAC join key for both principal types --
a human's Cognito/mock-OIDC `sub`, or an agent's derived hash -- so
`rbac.resolve_workspace_role` never has to branch on principal type.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime

import asyncpg

from weave_backend.db.pool import untenanted_connection


class PrincipalNotFound(Exception):
    """Raised when no principal row matches the given (tenant_id, iri)."""


@dataclass(frozen=True)
class WorkspaceMembership:
    workspace_id: str
    role: str


@dataclass(frozen=True)
class PrincipalRecord:
    iri: str
    type: str
    display_name: str
    created_at: datetime
    workspace_memberships: list[WorkspaceMembership]


@dataclass(frozen=True)
class AgentSummary:
    iri: str
    display_name: str
    workspace_id: str
    created_at: datetime


def human_principal_iri(sub: str) -> str:
    return f"urn:weave:principal:user:{sub}"


def _agent_hash(iam_role_arn: str) -> str:
    return hashlib.sha256(iam_role_arn.encode()).hexdigest()[:16]


def agent_sub(iam_role_arn: str) -> str:
    """The RBAC join key for an agent -- deterministic from its role ARN,
    since an agent has no OIDC `sub` of its own.
    """
    return _agent_hash(iam_role_arn)


def agent_principal_iri(iam_role_arn: str) -> str:
    return f"urn:weave:principal:agent:{_agent_hash(iam_role_arn)}"


async def ensure_human_principal(
    conn: asyncpg.Connection, *, tenant_id: str, sub: str, display_name: str
) -> str:
    """AC-1: idempotent upsert -- the IRI is deterministic from `sub` alone,
    so this never needs to read a row back; a repeat login just refreshes
    `display_name`.
    """
    iri = human_principal_iri(sub)
    await conn.execute(
        """
        INSERT INTO principals (iri, tenant_id, type, sub, display_name)
        VALUES ($1, $2, 'human', $3, $4)
        ON CONFLICT (tenant_id, sub) DO UPDATE SET display_name = EXCLUDED.display_name
        """,
        iri,
        tenant_id,
        sub,
        display_name,
    )
    return iri


async def ensure_agent_principal(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    workspace_id: str,
    iam_role_arn: str,
    display_name: str,
) -> str:
    """AC-2: registers (or refreshes) an agent's registry row on every
    agent-token mint.
    """
    iri = agent_principal_iri(iam_role_arn)
    sub = agent_sub(iam_role_arn)
    await conn.execute(
        """
        INSERT INTO principals (iri, tenant_id, type, sub, display_name, iam_role_arn, workspace_id)
        VALUES ($1, $2, 'agent', $3, $4, $5, $6)
        ON CONFLICT (tenant_id, sub) DO UPDATE
            SET display_name = EXCLUDED.display_name, workspace_id = EXCLUDED.workspace_id
        """,
        iri,
        tenant_id,
        sub,
        display_name,
        iam_role_arn,
        workspace_id,
    )
    return iri


async def get_principal(
    conn: asyncpg.Connection, *, tenant_id: str, iri: str
) -> PrincipalRecord:
    """AC-6: a principal joined with its active workspace memberships."""
    row = await conn.fetchrow(
        "SELECT iri, type, sub, display_name, created_at FROM principals"
        " WHERE tenant_id = $1 AND iri = $2",
        tenant_id,
        iri,
    )
    if row is None:
        raise PrincipalNotFound(iri)

    membership_rows = await conn.fetch(
        "SELECT workspace_id, role FROM workspace_members"
        " WHERE tenant_id = $1 AND user_sub = $2 AND status = 'active'",
        tenant_id,
        row["sub"],
    )
    return PrincipalRecord(
        iri=row["iri"],
        type=row["type"],
        display_name=row["display_name"],
        created_at=row["created_at"],
        workspace_memberships=[
            WorkspaceMembership(workspace_id=str(m["workspace_id"]), role=m["role"])
            for m in membership_rows
        ],
    )


async def list_tenant_agents(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> list[AgentSummary]:
    """AC-7: agents registered in one workspace of the caller's own tenant
    -- the `tenant_id` filter plus RLS both enforce this can never cross a
    tenant boundary.
    """
    rows = await conn.fetch(
        "SELECT iri, display_name, workspace_id, created_at FROM principals"
        " WHERE tenant_id = $1 AND type = 'agent' AND workspace_id = $2",
        tenant_id,
        workspace_id,
    )
    return [
        AgentSummary(
            iri=r["iri"],
            display_name=r["display_name"],
            workspace_id=str(r["workspace_id"]),
            created_at=r["created_at"],
        )
        for r in rows
    ]


async def resolve_workspace_tenant(*, workspace_id: str) -> str | None:
    """ADR-005: resolves a workspace's tenant via the `SECURITY DEFINER` SQL
    function of the same name. The one legitimate use of an untenanted
    connection -- an agent authenticating for the first time has no tenant
    context yet, since establishing it is exactly this call's job.
    """
    async with untenanted_connection() as conn:
        value = await conn.fetchval("SELECT resolve_workspace_tenant($1)", workspace_id)
    return str(value) if value is not None else None

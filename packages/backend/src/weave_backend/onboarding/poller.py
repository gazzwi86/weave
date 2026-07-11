"""ONB-TASK-011: the M1 activation detector (ADR-004) -- a scheduled poller
per demo-active, not-yet-activated user. Resolves the latest published
version of the user's own workspace (CE-VERSION-1 equivalent -- see
module docstring note below) and, only on cursor advance, runs the
milestone's signal check before calling the shared `record_milestone`
entry point.

**In-process CE access, not HTTP (undocumented decision, logged here):**
`ce_version_client.py`/`ce_read_client.py` are true HTTP clients used from
request handlers that already carry the caller's bearer token. A background
poller has no request-scoped JWT to forward, and CE + onboarding share one
FastAPI process for M1 (`ce_version_client.py`'s own docstring) -- so this
module calls `operations.versioning.resolve_version` (CE-VERSION-1's own
"latest published" semantics) and `rdf.oxigraph_client.run_query`
in-process, the same precedent `requests/ce_read.py` already uses for
server-side CE-READ-1 access. No new service, no fabricated JWT.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import asyncpg
import httpx

from weave_backend.onboarding.milestones import MILESTONE_ID_BY_PATH, has_committed_entity
from weave_backend.onboarding.recorder import record_milestone
from weave_backend.operations.versioning import VersionNotFound, resolve_version
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import get_workspace

log = logging.getLogger(__name__)

#: AC-011-06: tunable poll interval, default 60s.
DEFAULT_POLL_INTERVAL_SECONDS = 60


@dataclass(frozen=True)
class PollableUser:
    tenant_id: str
    user_id: str  # principal_iri, e.g. urn:weave:principal:user:<sub>
    user_sub: str
    role_path: str
    cursor: str | None


def _sub_from_principal_iri(principal_iri: str) -> str:
    return principal_iri.rsplit(":", 1)[-1]


async def select_pollable_users(conn: asyncpg.Connection, tenant_id: str) -> list[PollableUser]:
    """AC-011-06: demo-active users (`sandbox_forked_at` set) on a path with
    a detector milestone who haven't fired it yet -- the anti-join against
    `activation` is the stop condition; once a user's row exists there, this
    query no longer selects them.
    """
    rows = await conn.fetch(
        "SELECT user_id, role_path, poll_cursor_version_iri FROM onboarding_state os "
        "WHERE tenant_id = $1 AND sandbox_forked_at IS NOT NULL "
        "AND role_path IN ('business', 'technical') "
        "AND NOT EXISTS (SELECT 1 FROM activation a WHERE a.tenant_id = os.tenant_id "
        "AND a.user_id = os.user_id AND a.milestone_id = 'first_committed_entity')",
        tenant_id,
    )
    return [
        PollableUser(
            tenant_id=tenant_id,
            user_id=str(row["user_id"]),
            user_sub=_sub_from_principal_iri(str(row["user_id"])),
            role_path=str(row["role_path"]),
            cursor=row["poll_cursor_version_iri"],
        )
        for row in rows
    ]


@dataclass(frozen=True)
class _OwnWorkspace:
    named_graph_iri: str
    latest_version_iri: str


async def _resolve_own_workspace(
    conn: asyncpg.Connection, user: PollableUser
) -> _OwnWorkspace | None:
    """AC-011-07: the user's own (never sandbox) workspace, with its latest
    *published* version -- `None` for any condition that means "nothing to
    check this cycle" (no active session, never published, or CE
    unreachable), so the caller never advances the cursor.
    """
    workspace_id = await get_active_workspace(user.tenant_id, user.user_sub)
    if workspace_id is None:
        return None

    try:
        workspace = await get_workspace(conn, tenant_id=user.tenant_id, workspace_id=workspace_id)
        if workspace is None:
            return None
        latest_version_iri = await resolve_version(
            conn, tenant_id=user.tenant_id, workspace_id=workspace_id, version="latest"
        )
    except VersionNotFound:
        return None  # never published -- nothing to check yet, cursor untouched
    except (httpx.HTTPError, asyncpg.PostgresError):
        log.warning("onboarding poller: CE unreachable resolving version, skipping cycle")
        return None

    return _OwnWorkspace(
        named_graph_iri=workspace.named_graph_iri, latest_version_iri=latest_version_iri
    )


async def poll_user(conn: asyncpg.Connection, user: PollableUser) -> None:
    """AC-011-01/05/07: one check cycle for one user. A locked milestone, a
    missing/unpublished own workspace, or a CE outage mid-cycle all skip
    without moving the cursor -- the cursor advances only after a completed
    cycle (ADR-004).
    """
    milestone_id = MILESTONE_ID_BY_PATH.get(user.role_path)
    if milestone_id is None:
        return  # AC-011-05: locked milestone, never evaluated

    own_workspace = await _resolve_own_workspace(conn, user)
    if own_workspace is None:
        return
    if own_workspace.latest_version_iri == user.cursor:
        return  # AC-011-01: no version advance -- nothing new to check

    try:
        fired = await has_committed_entity(own_workspace.named_graph_iri, user.user_id)
    except httpx.HTTPError:
        log.warning("onboarding poller: CE unreachable running signal check, skipping cycle")
        return

    if fired:
        await record_milestone(
            conn,
            tenant_id=user.tenant_id,
            user_id=user.user_id,
            milestone_id=milestone_id,
            source="poll",
        )

    await conn.execute(
        "UPDATE onboarding_state SET poll_cursor_version_iri = $3, poll_cursor_at = now() "
        "WHERE tenant_id = $1 AND user_id = $2",
        user.tenant_id,
        user.user_id,
        own_workspace.latest_version_iri,
    )

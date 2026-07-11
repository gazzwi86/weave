"""AC-1/AC-2/AC-6/AC-8/AC-9: widget-state DB access. Every function takes an
already tenant-scoped ``asyncpg.Connection`` (``tenant_connection``, ADR-005)
-- RLS is the isolation backstop, this layer never adds its own tenant_id
WHERE beyond what each query needs for its own row selection.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import asyncpg

from weave_backend.dashboard.default_tiles import DEFAULT_TILES, starter_specs_for_role
from weave_backend.schemas.dashboard import WidgetSpec


@dataclass(frozen=True)
class WidgetRow:
    id: str
    scope: str
    owner_principal_iri: str | None
    spec: WidgetSpec
    position: int
    last_result: Any
    fetched_at: datetime | None
    status: str
    refresh_interval_s: int
    suggested: bool


def _row_to_widget(row: asyncpg.Record) -> WidgetRow:
    spec_raw = row["spec"]
    spec = (
        WidgetSpec.model_validate_json(spec_raw)
        if isinstance(spec_raw, str)
        else (WidgetSpec.model_validate(spec_raw))
    )
    last_result_raw = row["last_result"]
    last_result = (
        json.loads(last_result_raw) if isinstance(last_result_raw, str) else last_result_raw
    )
    return WidgetRow(
        id=str(row["id"]),
        scope=row["scope"],
        owner_principal_iri=row["owner_principal_iri"],
        spec=spec,
        position=row["position"],
        last_result=last_result,
        fetched_at=row["fetched_at"],
        status=row["status"],
        refresh_interval_s=row["refresh_interval_s"],
        suggested=row["suggested"],
    )


async def seed_tenant_default_tiles(conn: asyncpg.Connection, *, tenant_id: str) -> None:
    """AC-2: seed the fixed default tile set (positions 0-5). Idempotent --
    ``ON CONFLICT DO NOTHING`` against ``widget_instances_position_uniq`` --
    safe to call from ``create_workspace_route``
    (``POST /tenants/{tenant_id}/workspaces``, this codebase's nearest thing
    to a tenant-provisioning event) and from the one-time backfill script's
    Python equivalent.
    """
    for position, tile in enumerate(DEFAULT_TILES):
        await conn.execute(
            """
            INSERT INTO widget_instances
                (tenant_id, scope, owner_principal_iri, spec, "position")
            VALUES ($1, 'tenant_default', NULL, $2::jsonb, $3)
            ON CONFLICT (tenant_id, scope, COALESCE(owner_principal_iri, ''), "position")
            DO NOTHING
            """,
            tenant_id,
            tile.model_dump_json(),
            position,
        )


async def ensure_user_starters(
    conn: asyncpg.Connection, *, tenant_id: str, owner_principal_iri: str, role: str
) -> None:
    """AC-8: on first dashboard load per user (no user-scope rows exist yet),
    seed role-appropriate starters, ``suggested=true``. The existence check
    is the "when" gate; the position-uniqueness index is the concurrency
    backstop for two parallel first-loads (implementation hint).
    """
    existing = await conn.fetchval(
        "SELECT 1 FROM widget_instances WHERE tenant_id = $1 AND scope = 'user'"
        " AND owner_principal_iri = $2 LIMIT 1",
        tenant_id,
        owner_principal_iri,
    )
    if existing is not None:
        return
    for position, tile in enumerate(starter_specs_for_role(role)):
        await conn.execute(
            """
            INSERT INTO widget_instances
                (tenant_id, scope, owner_principal_iri, spec, "position", suggested)
            VALUES ($1, 'user', $2, $3::jsonb, $4, true)
            ON CONFLICT (tenant_id, scope, COALESCE(owner_principal_iri, ''), "position")
            DO NOTHING
            """,
            tenant_id,
            owner_principal_iri,
            tile.model_dump_json(),
            position,
        )


#: TASK-017 (m2-delta.md §7, brief pseudocode): one placeholder spec, the
#: route composes its own payload rather than rendering this generically --
#: `bindings`/`component_type` here are markers only, never consumed by a
#: generic widget renderer.
_ROLE_HOME_TILE_SPEC = WidgetSpec(
    component_type="table",
    title="Role home snapshot",
    data_source_contracts=["CE-METRICS-1", "CE-READ-1"],
    bindings={"field": "role_home_snapshot"},
    column_span=12,
)


async def ensure_role_home_tile(
    conn: asyncpg.Connection, *, tenant_id: str, owner_principal_iri: str
) -> None:
    """AC-5: one `scope='role_home'` row per user -- the SWR cache
    role-home's degradation rides, same idempotent-insert pattern as
    `ensure_user_starters` above.
    """
    await conn.execute(
        """
        INSERT INTO widget_instances (tenant_id, scope, owner_principal_iri, spec, "position")
        VALUES ($1, 'role_home', $2, $3::jsonb, 0)
        ON CONFLICT (tenant_id, scope, COALESCE(owner_principal_iri, ''), "position")
        DO NOTHING
        """,
        tenant_id,
        owner_principal_iri,
        _ROLE_HOME_TILE_SPEC.model_dump_json(),
    )


#: TASK-017: role-home tiles are per-user, same as `scope='user'` rows --
#: `owner_principal_iri` filters both (Design Decisions table: "one SWR
#: path, no second cache/renderer").
_OWNER_SCOPED_SCOPES = ("user", "role_home")


async def list_widgets(
    conn: asyncpg.Connection, *, tenant_id: str, scope: str, owner_principal_iri: str | None
) -> list[WidgetRow]:
    """AC-6: pure SWR read -- returns whatever is already stored, no
    upstream CE call.
    """
    if scope in _OWNER_SCOPED_SCOPES:
        rows = await conn.fetch(
            "SELECT * FROM widget_instances WHERE tenant_id = $1 AND scope = $2"
            ' AND owner_principal_iri = $3 ORDER BY "position"',
            tenant_id,
            scope,
            owner_principal_iri,
        )
    else:
        rows = await conn.fetch(
            "SELECT * FROM widget_instances WHERE tenant_id = $1 AND scope = $2"
            ' ORDER BY "position"',
            tenant_id,
            scope,
        )
    return [_row_to_widget(row) for row in rows]


async def get_widget(
    conn: asyncpg.Connection, *, tenant_id: str, widget_id: str
) -> WidgetRow | None:
    row = await conn.fetchrow(
        "SELECT * FROM widget_instances WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        widget_id,
    )
    return _row_to_widget(row) if row is not None else None


@dataclass(frozen=True)
class RefreshOutcome:
    """Bundles a refresh attempt's result -- keeps ``apply_refresh_result``'s
    parameter count under Law E's cap (≤5).
    """

    last_result: Any
    status: str
    fetched_at: datetime | None


async def apply_refresh_result(
    conn: asyncpg.Connection, *, tenant_id: str, widget_id: str, outcome: RefreshOutcome
) -> None:
    """AC-7: on success, ``last_result``/``fetched_at`` update atomically
    with ``status``. On failure the caller passes the *retained* prior
    ``last_result``/``fetched_at`` through unchanged -- this always writes
    all three columns together so there is one code path, not a
    success/failure branch here.
    """
    await conn.execute(
        """
        UPDATE widget_instances
        SET last_result = $3::jsonb, fetched_at = $4, status = $5, updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        widget_id,
        json.dumps(outcome.last_result) if outcome.last_result is not None else None,
        outcome.fetched_at,
        outcome.status,
    )


async def insert_generated_widget(
    conn: asyncpg.Connection, *, tenant_id: str, owner_principal_iri: str, spec: WidgetSpec
) -> str:
    """TASK-011 AC-2/AC-5: insert a freshly-generated `scope='user'` widget
    row inside the caller's already-open transaction. The caller raises
    `MidStreamCap` (generate.py) after this to roll the transaction back --
    this function does no error handling of its own, by design.

    ponytail: the next `position` is read then inserted in the same
    transaction, not under an explicit lock -- two concurrent first-time
    generations for the same user could in principle race on one position
    (rare, low-stakes UI ordering only, not a correctness/tenancy issue).
    Upgrade path: `SELECT ... FOR UPDATE` if that shows up in practice.
    """
    position = await conn.fetchval(
        'SELECT COALESCE(MAX("position"), -1) + 1 FROM widget_instances'
        " WHERE tenant_id = $1 AND scope = 'user' AND owner_principal_iri = $2",
        tenant_id,
        owner_principal_iri,
    )
    widget_id = await conn.fetchval(
        """
        INSERT INTO widget_instances
            (tenant_id, scope, owner_principal_iri, spec, "position", status)
        VALUES ($1, 'user', $2, $3::jsonb, $4, 'fresh')
        RETURNING id
        """,
        tenant_id,
        owner_principal_iri,
        spec.model_dump_json(),
        position,
    )
    return str(widget_id)


async def update_widget_component_type(
    conn: asyncpg.Connection, *, tenant_id: str, widget_id: str, component_type: str
) -> bool:
    """Change-visualisation persistence (TASK-012, m2-delta §5): merge-patch
    only `component_type` into the stored spec JSONB -- title/bindings/
    contracts survive untouched, never a whole-spec replace.
    """
    result: str = await conn.execute(
        """
        UPDATE widget_instances
        SET spec = jsonb_set(spec, '{component_type}', to_jsonb($3::text)), updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        widget_id,
        component_type,
    )
    return bool(result != "UPDATE 0")


async def delete_widget(conn: asyncpg.Connection, *, tenant_id: str, widget_id: str) -> bool:
    """AC-8: starter removal / unpin. User-scope + owner-only is enforced by
    the caller (router checks ``owner_principal_iri`` before calling this).
    """
    result: str = await conn.execute(
        "DELETE FROM widget_instances WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        widget_id,
    )
    return bool(result != "DELETE 0")


def utcnow() -> datetime:
    return datetime.now(UTC)

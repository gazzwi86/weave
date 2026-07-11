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


async def list_widgets(
    conn: asyncpg.Connection, *, tenant_id: str, scope: str, owner_principal_iri: str | None
) -> list[WidgetRow]:
    """AC-6: pure SWR read -- returns whatever is already stored, no
    upstream CE call.
    """
    if scope == "user":
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


async def pin_widget(conn: asyncpg.Connection, *, tenant_id: str, widget_id: str) -> bool:
    """TASK-014 AC-1/AC-6 (ADR-021): pin acts on an already-persisted
    `scope='user'` row (generate.py already inserts it) -- clears
    `suggested` so a starter/suggested tile becomes a genuine pin. Returns
    `False` if the row doesn't exist (caller 404s); a no-op update (already
    unsuggested) still returns `True`.
    """
    result: str = await conn.execute(
        "UPDATE widget_instances SET suggested = false, updated_at = now()"
        " WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        widget_id,
    )
    return bool(result != "UPDATE 0")


async def reorder_widgets(
    conn: asyncpg.Connection, *, tenant_id: str, owner_principal_iri: str, ids_in_order: list[str]
) -> int:
    """TASK-014 AC-5: batch reorder -- one PATCH, one audit entry (caller's
    responsibility). Only touches rows owned by this user; an id that
    doesn't belong to the caller (wrong tenant, wrong owner, or simply
    unknown) is silently skipped rather than erroring the whole batch --
    the returned count is the "updated" figure the route reports.

    Positions are offset by a large constant first so the final pass never
    collides with the unique `(tenant_id, scope, owner, position)` index
    while ids are mid-reassignment within the same statement batch.
    """
    offset = len(ids_in_order) + 1000
    for index, widget_id in enumerate(ids_in_order):
        await conn.execute(
            "UPDATE widget_instances SET \"position\" = $3, updated_at = now()"
            " WHERE tenant_id = $1 AND id = $2 AND scope = 'user' AND owner_principal_iri = $4",
            tenant_id,
            widget_id,
            offset + index,
            owner_principal_iri,
        )
    updated = 0
    for index, widget_id in enumerate(ids_in_order):
        result: str = await conn.execute(
            "UPDATE widget_instances SET \"position\" = $3, updated_at = now()"
            " WHERE tenant_id = $1 AND id = $2 AND scope = 'user' AND owner_principal_iri = $4",
            tenant_id,
            widget_id,
            index,
            owner_principal_iri,
        )
        if result != "UPDATE 0":
            updated += 1
    return updated


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


@dataclass(frozen=True)
class LibraryItemRow:
    id: str
    name: str
    description: str | None
    author_principal_iri: str
    published_at: datetime
    spec: WidgetSpec


def _row_to_library_item(row: asyncpg.Record) -> LibraryItemRow:
    spec_raw = row["spec"]
    spec = (
        WidgetSpec.model_validate_json(spec_raw)
        if isinstance(spec_raw, str)
        else WidgetSpec.model_validate(spec_raw)
    )
    return LibraryItemRow(
        id=str(row["id"]),
        name=row["name"],
        description=row["description"],
        author_principal_iri=row["author_principal_iri"],
        published_at=row["published_at"],
        spec=spec,
    )


@dataclass(frozen=True)
class PublishInput:
    """Bundled so `publish_widget` stays under the 5-param complexity cap."""

    name: str
    description: str | None
    spec: WidgetSpec
    author_principal_iri: str


async def publish_widget(
    conn: asyncpg.Connection, *, tenant_id: str, publish: PublishInput
) -> LibraryItemRow:
    """TASK-015 AC-1: `spec` is a snapshot copy of the source widget's spec
    at publish time -- the library item never references the source row, so
    the source widget's later refinement can't retroactively change it
    (ADR-014, E1-S5 independent-copy semantics).
    """
    row = await conn.fetchrow(
        """
        INSERT INTO widget_library_items
            (tenant_id, name, description, spec, author_principal_iri)
        VALUES ($1, $2, $3, $4::jsonb, $5)
        RETURNING id, name, description, author_principal_iri, published_at, spec
        """,
        tenant_id,
        publish.name,
        publish.description,
        publish.spec.model_dump_json(),
        publish.author_principal_iri,
    )
    return _row_to_library_item(row)


async def list_library_items(conn: asyncpg.Connection, *, tenant_id: str) -> list[LibraryItemRow]:
    rows = await conn.fetch(
        "SELECT id, name, description, author_principal_iri, published_at, spec"
        " FROM widget_library_items WHERE tenant_id = $1 ORDER BY published_at DESC",
        tenant_id,
    )
    return [_row_to_library_item(row) for row in rows]


async def get_library_item(
    conn: asyncpg.Connection, *, tenant_id: str, item_id: str
) -> LibraryItemRow | None:
    row = await conn.fetchrow(
        "SELECT id, name, description, author_principal_iri, published_at, spec"
        " FROM widget_library_items WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        item_id,
    )
    return _row_to_library_item(row) if row is not None else None


async def add_library_item(
    conn: asyncpg.Connection, *, tenant_id: str, owner_principal_iri: str, item: LibraryItemRow
) -> str:
    """TASK-015 AC-3: an ordinary `scope='user'` widget row, carrying
    `library_item_id` provenance only -- refine/unpin/refresh from here on
    are the plain TASK-010/013/014 code paths, zero special-casing.
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
            (tenant_id, scope, owner_principal_iri, spec, "position", status, library_item_id)
        VALUES ($1, 'user', $2, $3::jsonb, $4, 'fresh', $5)
        RETURNING id
        """,
        tenant_id,
        owner_principal_iri,
        item.spec.model_dump_json(),
        position,
        item.id,
    )
    return str(widget_id)


def utcnow() -> datetime:
    return datetime.now(UTC)

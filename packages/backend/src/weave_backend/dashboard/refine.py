"""PLAT-V1-TASK-013: refinement-history persistence + cap resolution.

`generate.py::generate_widget_stream` calls into this module for the
refine-specific persistence tail only -- budget gate, resolver-context
threading, metering, and audit all stay in `generate.py`/`intent.py`
unduplicated (Design Decisions table: "any re-implementation is a review
Blocker"). `widget_refinements` (columns `step`/`spec`) already exists from
TASK-010's `migrations/0045_widget_state.sql` -- no new migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import asyncpg

from weave_backend.schemas.dashboard import WidgetSpec
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import company_iri

#: AC-2: tunable via PLAT-SETTINGS-1. Resolved at company scope -- the
#: dashboard prompt bar is a tenant-wide feature (generate.py's own
#: comment), so the cap is one tenant-wide knob, not per-workspace.
HISTORY_CAP_KEY = "dashboard.refinement_history.cap"
_DEFAULT_HISTORY_CAP = 10


@dataclass(frozen=True)
class RefinementOutcome:
    """Bundles a successful refine's write payload -- mirrors
    `store.RefreshOutcome`'s shape, plus the prompt/spec history needs.
    """

    prompt: str
    spec: WidgetSpec
    last_result: Any
    fetched_at: datetime


@dataclass(frozen=True)
class HistoryStep:
    seq: int
    prompt: str
    created_at: datetime


@dataclass(frozen=True)
class RestoreOutcome:
    """Bundles a restore's write payload -- keeps `restore_widget_spec` under
    Law E's 5-param cap alongside `conn`/`tenant_id`/`widget_id`.
    """

    spec: WidgetSpec
    last_result: Any
    fetched_at: datetime | None
    status: str


async def resolve_history_cap(conn: asyncpg.Connection, tenant_id: str) -> int:
    """AC-2: fail-open default of 10 when no PLAT-SETTINGS-1 row exists
    anywhere in the cascade -- same `resolve_setting`/`SettingNotFound`
    shape as `billing/gate.py::enforce_budget`, not a hardcoded constant
    (the `example_prompts.py::EXAMPLE_PROMPTS_HIDE_AFTER` anti-pattern this
    task must not repeat).
    """
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=HISTORY_CAP_KEY, context_iri=company_iri(tenant_id)
        )
    except SettingNotFound:
        return _DEFAULT_HISTORY_CAP
    return int(resolved.value)


async def apply_refinement(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    widget_id: str,
    outcome: RefinementOutcome,
    cap: int,
) -> None:
    """AC-2/Implementation Hints: row-lock the widget first (serialises
    concurrent refines' cap eviction), update spec/last_result/fetched_at,
    insert the next history step, then evict steps past `cap` -- all inside
    the caller's already-open transaction (`generate.py`'s
    `tenant_connection`), so AC-3 (no write on any error path) holds by
    construction: this only runs after the stream's fetch loop succeeds.
    """
    await conn.execute(
        "SELECT 1 FROM widget_instances WHERE tenant_id = $1 AND id = $2 FOR UPDATE",
        tenant_id,
        widget_id,
    )
    await conn.execute(
        """
        UPDATE widget_instances
        SET spec = $3::jsonb, last_result = $4::jsonb, fetched_at = $5, status = 'fresh',
            updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        widget_id,
        outcome.spec.model_dump_json(),
        json.dumps(outcome.last_result) if outcome.last_result is not None else None,
        outcome.fetched_at,
    )
    next_seq = await conn.fetchval(
        "SELECT COALESCE(MAX(step), 0) + 1 FROM widget_refinements"
        " WHERE tenant_id = $1 AND widget_instance_id = $2",
        tenant_id,
        widget_id,
    )
    await conn.execute(
        """
        INSERT INTO widget_refinements (tenant_id, widget_instance_id, step, prompt, spec)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        """,
        tenant_id,
        widget_id,
        next_seq,
        outcome.prompt,
        outcome.spec.model_dump_json(),
    )
    # Keep only the newest `cap` steps: delete anything at or below
    # (max_step - cap). E.g. cap=10, 12 rows (steps 1..12) -> delete
    # step <= 2, leaving steps 3..12 (the latest 10).
    await conn.execute(
        """
        DELETE FROM widget_refinements
        WHERE tenant_id = $1 AND widget_instance_id = $2
          AND step <= (
            SELECT MAX(step) - $3 FROM widget_refinements
            WHERE tenant_id = $1 AND widget_instance_id = $2
          )
        """,
        tenant_id,
        widget_id,
        cap,
    )


async def list_history(
    conn: asyncpg.Connection, *, tenant_id: str, widget_id: str
) -> list[HistoryStep]:
    """AC-4: specs are deliberately omitted -- fetched only on restore."""
    rows = await conn.fetch(
        "SELECT step, prompt, created_at FROM widget_refinements"
        " WHERE tenant_id = $1 AND widget_instance_id = $2 ORDER BY step",
        tenant_id,
        widget_id,
    )
    return [
        HistoryStep(seq=row["step"], prompt=row["prompt"], created_at=row["created_at"])
        for row in rows
    ]


async def get_refinement_spec(
    conn: asyncpg.Connection, *, tenant_id: str, widget_id: str, seq: int
) -> WidgetSpec | None:
    row = await conn.fetchrow(
        "SELECT spec FROM widget_refinements"
        " WHERE tenant_id = $1 AND widget_instance_id = $2 AND step = $3",
        tenant_id,
        widget_id,
        seq,
    )
    if row is None:
        return None
    spec_raw = row["spec"]
    return (
        WidgetSpec.model_validate_json(spec_raw)
        if isinstance(spec_raw, str)
        else WidgetSpec.model_validate(spec_raw)
    )


async def restore_widget_spec(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    widget_id: str,
    outcome: RestoreOutcome,
) -> None:
    """AC-4/Design Decisions: restore swaps `spec`+data without a model call
    and is deliberately NOT appended to `widget_refinements` -- replaying a
    step is not a new step. Same UPDATE shape as
    `store.apply_refresh_result`, plus the `spec` column.
    """
    await conn.execute(
        """
        UPDATE widget_instances
        SET spec = $3::jsonb, last_result = $4::jsonb, fetched_at = $5, status = $6,
            updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        widget_id,
        outcome.spec.model_dump_json(),
        json.dumps(outcome.last_result) if outcome.last_result is not None else None,
        outcome.fetched_at,
        outcome.status,
    )

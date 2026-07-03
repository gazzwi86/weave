"""AC-4/AC-5: cascade resolution and tighter-wins write guard.

ponytail: the "does a tighter scope already have this key" check (AC-5) is
only enforced for writes at `company` scope. `domain`/`workspace`/`project`
have no modelled parent-child linkage in this task (see `scope.py`'s ADR-004
note), so we can only *prove* descendance for `company` (every workspace
belongs to exactly one tenant/company). Extend this once domains/projects
are real, queryable entities.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import asyncpg

from weave_backend.settings.scope import SCOPE_RANK, ancestor_chain, scope_of


class SettingNotFound(Exception):
    """Raised when no explicit value exists anywhere in the cascade."""


class LooserOverrideRejected(Exception):
    def __init__(self, tighter_scope: str) -> None:
        self.tighter_scope = tighter_scope
        super().__init__(f"tighter scope already set: {tighter_scope}")


@dataclass(frozen=True)
class ResolvedSetting:
    key: str
    value: Any
    resolved_at: str
    resolved_from_iri: str


async def resolve_setting(
    conn: asyncpg.Connection, *, tenant_id: str, key: str, context_iri: str
) -> ResolvedSetting:
    # PR #11 finding 8: one query for the whole chain instead of a
    # sequential SELECT per ancestor scope. `ancestor_chain` is already
    # tightest-first, so the first hit found while walking it in Python is
    # the tightest-wins result -- no need to re-rank by SCOPE_RANK here.
    chain = ancestor_chain(context_iri)
    rows = await conn.fetch(
        """
        SELECT scope_iri, scope, value FROM settings
        WHERE tenant_id = $1 AND scope_iri = ANY($2) AND key = $3
        """,
        tenant_id,
        chain,
        key,
    )
    by_iri = {row["scope_iri"]: row for row in rows}
    for iri in chain:
        row = by_iri.get(iri)
        if row is not None:
            return ResolvedSetting(
                key=key,
                value=json.loads(row["value"]),
                resolved_at=row["scope"],
                resolved_from_iri=iri,
            )
    raise SettingNotFound(key)


async def set_setting(
    conn: asyncpg.Connection, *, tenant_id: str, key: str, scope_iri: str, value: Any
) -> None:
    scope = scope_of(scope_iri)
    rank = SCOPE_RANK[scope]
    if scope == "company":
        tighter = await conn.fetchrow(
            """
            SELECT scope FROM settings
            WHERE tenant_id = $1 AND key = $2 AND scope_rank < $3
            ORDER BY scope_rank ASC LIMIT 1
            """,
            tenant_id,
            key,
            rank,
        )
        if tighter is not None:
            raise LooserOverrideRejected(tighter["scope"])

    await conn.execute(
        """
        INSERT INTO settings (tenant_id, scope, scope_rank, scope_iri, key, value)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (tenant_id, scope_iri, key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        """,
        tenant_id,
        scope,
        rank,
        scope_iri,
        key,
        json.dumps(value),
    )

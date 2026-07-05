"""AC-1: budget-cap validation. A cap is a plain PLAT-SETTINGS-1 settings
row (same cascade, same `resolve_setting`/`set_setting`) -- no separate caps
table. The one invariant `set_setting` doesn't already enforce is this
task's: a child scope's cap can never exceed its resolved parent cap.
"""

from __future__ import annotations

import asyncpg

from weave_backend.settings.resolver import SettingNotFound, resolve_setting, set_setting
from weave_backend.settings.scope import ancestor_chain

BUDGET_CAP_KEY = "ai.budget.per_period_usd"


class CapExceedsParent(Exception):
    def __init__(self, parent_cap_usd: float) -> None:
        self.parent_cap_usd = parent_cap_usd
        super().__init__(f"cap exceeds parent cap: {parent_cap_usd}")


async def set_cap(
    conn: asyncpg.Connection, *, tenant_id: str, key: str, scope_iri: str, value_usd: float
) -> None:
    chain = ancestor_chain(scope_iri)
    if len(chain) > 1:
        try:
            parent = await resolve_setting(
                conn, tenant_id=tenant_id, key=key, context_iri=chain[1]
            )
        except SettingNotFound:
            parent = None
        if parent is not None and value_usd > parent.value:
            raise CapExceedsParent(parent.value)
    await set_setting(conn, tenant_id=tenant_id, key=key, scope_iri=scope_iri, value=value_usd)

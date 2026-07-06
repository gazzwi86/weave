"""Cost-estimate heuristic + PLAT-SETTINGS-1 cap resolution (BE-TASK-004,
build-engine EPIC-001).
"""

from __future__ import annotations

import asyncpg

from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import company_iri

#: Design-decision table: "default cap ~$25" when nothing has been set
#: anywhere in the PLAT-SETTINGS-1 cascade.
DEFAULT_COST_CAP_USD = 25.0

_COST_CAP_SETTING_KEY = "spec_cost_cap_usd"

#: ponytail: brief's own pseudocode comment says "token-count heuristic",
#: not a real LLM pricing model -- ~4 chars/token, a placeholder $/1k-token
#: rate. Swap for a real pricing table once one exists.
_CHARS_PER_TOKEN = 4
_USD_PER_1K_TOKENS = 0.01


def estimate_spec_cost(draft_content: dict[str, str] | None) -> float:
    """AC-3: token-count heuristic over the total length of the drafted
    sections.
    """
    if not draft_content:
        return 0.0
    total_chars = sum(len(text) for text in draft_content.values())
    total_tokens = total_chars / _CHARS_PER_TOKEN
    return round((total_tokens / 1000) * _USD_PER_1K_TOKENS, 4)


async def resolve_cost_cap(conn: asyncpg.Connection, *, tenant_id: str) -> tuple[float, str]:
    """AC-3: resolve the per-spec cap from the PLAT-SETTINGS-1 cascade
    (tighter-wins).

    ponytail: a `RequestRecord` has no workspace/project binding (Redis
    scratch state, ADR-001), so this only ever resolves from `company`
    scope -- there's no ancestor chain to walk yet. `resolve_setting` raises
    `SettingNotFound` when nothing is set anywhere (it has no built-in
    default by design); `DEFAULT_COST_CAP_USD` is this module's own
    business default for that case.
    """
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=_COST_CAP_SETTING_KEY,
            context_iri=company_iri(tenant_id),
        )
    except SettingNotFound:
        return DEFAULT_COST_CAP_USD, "company"
    return float(resolved.value), resolved.resolved_at

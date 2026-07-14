"""AC-002-04: confidence-flag threshold cascade (PLAT-SETTINGS-1
`ingest.confidence_flag_threshold`). Mirrors `requests/cost.py::resolve_cost_cap`
-- `resolve_setting` has no built-in default; `DEFAULT_CONFIDENCE_THRESHOLD` is
this module's own business default for when nothing is set anywhere in the
cascade (DoD invariant: no literal 0.6 outside this one settings default).
"""

from __future__ import annotations

import asyncpg

from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import workspace_iri

DEFAULT_CONFIDENCE_THRESHOLD = 0.6

CONFIDENCE_THRESHOLD_SETTING_KEY = "ingest.confidence_flag_threshold"


async def resolve_confidence_threshold(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> float:
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=CONFIDENCE_THRESHOLD_SETTING_KEY,
            context_iri=workspace_iri(tenant_id, workspace_id),
        )
    except SettingNotFound:
        return DEFAULT_CONFIDENCE_THRESHOLD
    return float(resolved.value)

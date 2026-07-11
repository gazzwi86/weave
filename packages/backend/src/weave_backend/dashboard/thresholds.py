"""AC-5: every category binding's threshold/window resolves via
PLAT-SETTINGS-1 (`settings.resolver`) with a named default -- never a
literal in `bindings.py` (epic AC; grep-verified in the DoD). Keys and
defaults match the brief's normative binding table verbatim.
"""

from __future__ import annotations

import asyncpg

from weave_backend.settings.resolver import SettingNotFound, resolve_setting

#: key -> default. One place these are named; `bindings.py` never
#: hard-codes a threshold value.
DEFAULTS: dict[str, float] = {
    "dashboard.version_lag.amber": 2,
    "dashboard.version_lag.red": 4,
    "dashboard.ops.spike_factor": 2.0,
    "dashboard.ops.window_days": 7,
    "dashboard.growth.stagnation_days": 14,
    "dashboard.growth.window_days": 30,
    "dashboard.growth.long_window_days": 90,
    "dashboard.billing.burn_rate_alert_pct": 90,
    "dashboard.billing.refresh_lag_minutes": 5,
    # PLAT-V1-TASK-024 (E2-S9): recent-edits collaboration widget.
    "dashboard.collaboration.retain_rows": 50,
    "dashboard.collaboration.tail": 20,
}


async def threshold(
    conn: asyncpg.Connection, *, tenant_id: str, context_iri: str, key: str
) -> float:
    """Resolve `key` through the settings cascade; fall back to `DEFAULTS`
    when no tenant/domain/project override exists (AC-5's "never
    hard-coded" is satisfied by the fallback living HERE, named, not
    inlined at each call site).
    """
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=key, context_iri=context_iri
        )
        return float(resolved.value)
    except SettingNotFound:
        return DEFAULTS[key]

"""AC-2/AC-6: synchronous pre-call budget gate, plus cap-utilisation
notifications. No cap configured anywhere in the cascade = unmetered,
fail-open (ADR-009) -- deliberate, not an oversight.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg
import redis.asyncio as redis_lib

from weave_backend.billing.caps import BUDGET_CAP_KEY
from weave_backend.billing.metering import consumed_key
from weave_backend.billing.period import current_period, next_period_start_iso
from weave_backend.identity.registry import human_principal_iri
from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.store import NotificationEvent
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import workspace_iri

#: AC-6 thresholds -- warning at 80% utilisation, reached at 100%.
WARNING_THRESHOLD = 0.8
REACHED_THRESHOLD = 1.0


@dataclass(frozen=True)
class BillingScope:
    tenant_id: str
    workspace_id: str


class BudgetCapReached(Exception):
    def __init__(self, *, cap_usd: float, retry_after: str) -> None:
        self.cap_usd = cap_usd
        self.retry_after = retry_after
        super().__init__(f"budget cap reached: {cap_usd}")


async def enforce_budget(
    conn: asyncpg.Connection, redis: redis_lib.Redis, scope: BillingScope
) -> None:
    """Raise `BudgetCapReached` (429, `budget_cap_reached`) if the current
    period's consumed cost has hit or passed the cascade-resolved cap.
    Must run -- and reject -- before any external AI call is made.
    """
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=scope.tenant_id,
            key=BUDGET_CAP_KEY,
            context_iri=workspace_iri(scope.tenant_id, scope.workspace_id),
        )
    except SettingNotFound:
        return  # ponytail: no cap set anywhere -- unmetered, fail-open (ADR-009)

    cap_usd = float(resolved.value)
    consumed_usd = float(
        await redis.get(consumed_key(scope.tenant_id, scope.workspace_id, current_period())) or 0
    )
    utilisation = consumed_usd / cap_usd if cap_usd > 0 else 1.0

    if utilisation >= REACHED_THRESHOLD:
        await _notify_workspace_admins(conn, scope, "billing.cap.reached", utilisation)
        raise BudgetCapReached(cap_usd=cap_usd, retry_after=next_period_start_iso())
    if utilisation >= WARNING_THRESHOLD:
        await _notify_workspace_admins(conn, scope, "billing.cap.warning", utilisation)


async def _notify_workspace_admins(
    conn: asyncpg.Connection, scope: BillingScope, event_type: str, utilisation: float
) -> None:
    admin_subs = await conn.fetch(
        """
        SELECT user_sub FROM workspace_members
        WHERE tenant_id = $1 AND workspace_id = $2 AND role = 'admin' AND user_sub IS NOT NULL
        """,
        scope.tenant_id,
        scope.workspace_id,
    )
    for row in admin_subs:
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=scope.tenant_id,
                recipient_iri=human_principal_iri(row["user_sub"]),
                event_type=event_type,
                payload={"workspace_id": scope.workspace_id, "utilisation_pct": utilisation * 100},
                actor_iri="urn:weave:system:billing",
            ),
        )

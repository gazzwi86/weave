"""AC-4/AC-5/AC-7: the honest-state matrix (m2-delta.md §6, ADR-013) --
shared server logic; the client only renders whatever ``pending_fields`` /
``status`` this module computes, never re-derives it (implementation hint).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from weave_backend.schemas.dashboard import WidgetStatus


def pending_fields_of(spec_field: str, last_result: Any) -> list[str]:
    """AC-5: a widget's ``last_result`` is pending when CE-METRICS-1 returned
    ``{"pending": true}`` for the bound field, in place of real counts --
    never render a zero for it.
    """
    if isinstance(last_result, dict) and last_result.get("pending") is True:
        return [spec_field]
    return []


@dataclass(frozen=True)
class DerivedStatus:
    status: WidgetStatus
    pending_fields: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class WidgetFetchState:
    """The stored/attempted-fetch state ``derive_status`` decides over --
    bundled to keep the function's parameter count under Law E's cap (≤5).
    """

    last_result: Any
    fetched_at: datetime | None
    refresh_interval_s: int


def derive_status(
    *, spec_field: str, state: WidgetFetchState, fetch_failed: bool, now: datetime
) -> DerivedStatus:
    """AC-4/AC-5/AC-7: one status decision, used both right after a refresh
    attempt (``fetch_failed`` reflects that attempt) and at read time to
    apply the staleness bound against an already-stored row
    (``fetch_failed=False`` -- no attempt was made, only the age check
    applies).
    """
    pending_fields = pending_fields_of(spec_field, state.last_result)
    if fetch_failed:
        status: WidgetStatus = "unavailable" if state.last_result is None else "stale"
    elif pending_fields:
        status = "pending"
    else:
        status = "fresh"

    # ADR-013 staleness bound: a payload older than 2x the refresh interval
    # renders stale even with no failed refresh -- never silently presented
    # as current. Doesn't apply to unavailable (nothing to go stale).
    is_aged = state.fetched_at is not None and now - state.fetched_at >= timedelta(
        seconds=2 * state.refresh_interval_s
    )
    if status != "unavailable" and is_aged:
        status = "stale"

    return DerivedStatus(status=status, pending_fields=pending_fields)

"""AC-4/AC-5/AC-7: honest-state matrix (ADR-013, m2-delta.md §6) -- pure
function, no DB.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from weave_backend.dashboard.status import WidgetFetchState, derive_status, pending_fields_of

_NOW = datetime(2026, 7, 10, 12, 0, 0, tzinfo=UTC)


def test_pending_shape_never_renders_zeros() -> None:
    """AC-5: a `{"pending": true}` sub-field surfaces as a named pending
    field, never a `0` -- the caller has no branch that could coerce it.
    """
    assert pending_fields_of("shacl_errors_by_severity", {"pending": True}) == [
        "shacl_errors_by_severity"
    ]
    assert pending_fields_of("entity_count_by_kind", {"Process": 4}) == []
    assert pending_fields_of("entity_count_by_kind", None) == []


@pytest.mark.parametrize(
    ("fetch_failed", "last_result", "fetched_at", "expected_status"),
    [
        # Successful fetch, fresh count -> fresh.
        (False, {"Process": 4}, _NOW, "fresh"),
        # Successful fetch, CE-METRICS-1 pending sub-field -> pending.
        (False, {"pending": True}, _NOW, "pending"),
        # Failed refresh, no prior payload ever stored -> unavailable.
        (True, None, None, "unavailable"),
        # Failed refresh, but a prior payload exists -> stale, retains it.
        (True, {"Process": 4}, _NOW - timedelta(minutes=20), "stale"),
    ],
)
def test_derive_status_matrix(
    fetch_failed: bool,
    last_result: object,
    fetched_at: datetime | None,
    expected_status: str,
) -> None:
    derived = derive_status(
        spec_field="entity_count_by_kind",
        state=WidgetFetchState(
            last_result=last_result, fetched_at=fetched_at, refresh_interval_s=300
        ),
        fetch_failed=fetch_failed,
        now=_NOW,
    )
    assert derived.status == expected_status


def test_staleness_bound() -> None:
    """AC-7: a payload older than 2x the refresh interval renders stale even
    with no failed refresh -- the age check applies independently of
    `fetch_failed`.
    """
    refresh_interval_s = 300
    just_under = derive_status(
        spec_field="entity_count_by_kind",
        state=WidgetFetchState(
            last_result={"Process": 4},
            fetched_at=_NOW - timedelta(seconds=2 * refresh_interval_s - 1),
            refresh_interval_s=refresh_interval_s,
        ),
        fetch_failed=False,
        now=_NOW,
    )
    at_bound = derive_status(
        spec_field="entity_count_by_kind",
        state=WidgetFetchState(
            last_result={"Process": 4},
            fetched_at=_NOW - timedelta(seconds=2 * refresh_interval_s),
            refresh_interval_s=refresh_interval_s,
        ),
        fetch_failed=False,
        now=_NOW,
    )

    assert just_under.status == "fresh"
    assert at_bound.status == "stale"

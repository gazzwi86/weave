"""QA edge case (PLAT-TASK-008): `next_period_start_iso`'s year rollover at
December was untested -- the only consumer (`gate.py`'s `retry_after`) is
exercised in tests that never freeze the clock in December, so a broken
`year + 1` branch would pass every existing test silently.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import patch

from weave_backend.billing.period import current_period, next_period_start_iso


def test_next_period_start_iso_rolls_over_to_january_next_year() -> None:
    with patch("weave_backend.billing.period.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 12, 15, 12, 0, 0, tzinfo=UTC)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
        assert next_period_start_iso() == "2027-01-01T00:00:00Z"


def test_next_period_start_iso_same_year_mid_month() -> None:
    with patch("weave_backend.billing.period.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 7, 4, 8, 30, 0, tzinfo=UTC)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
        assert next_period_start_iso() == "2026-08-01T00:00:00Z"


def test_current_period_zero_pads_single_digit_month() -> None:
    with patch("weave_backend.billing.period.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 3, 1, tzinfo=UTC)
        assert current_period() == "2026-03"

"""PLAT-BILLING-1: billing period = calendar month, UTC. The Redis
running-total key and the durable Aurora record both key off this same
string, so a mid-request clock read never splits one month's usage across
two counters.
"""

from __future__ import annotations

from datetime import UTC, datetime


def current_period() -> str:
    now = datetime.now(UTC)
    return f"{now.year:04d}-{now.month:02d}"


def next_period_start_iso() -> str:
    """First second of next month, UTC -- the `retry_after` value in the 429
    body, telling a rejected caller exactly when their cap resets.
    """
    now = datetime.now(UTC)
    year, month = (now.year + 1, 1) if now.month == 12 else (now.year, now.month + 1)
    return datetime(year, month, 1, tzinfo=UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

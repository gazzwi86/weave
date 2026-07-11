"""PLAT-V1-TASK-024 (AC-2): pure activity-feed shaping, kept out of
`bindings.py`'s I/O so the draft-badge/top-contributors/merge logic is
unit-testable without a DB or CE stack.
"""

from __future__ import annotations

from collections import Counter
from typing import Any


def is_draft(row: dict[str, Any]) -> bool:
    """AC-2: `version_iri: null` is a draft commit -- a null-check, not a
    second query (Design Decisions table).
    """
    return row.get("version_iri") is None


def top_contributors(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """AC-2: count of retained rows by `actor`, most-active first."""
    counts = Counter(row["actor"] for row in rows)
    return [{"actor": actor, "count": count} for actor, count in counts.most_common()]


def merge_newest_first(
    new_rows_asc: list[dict[str, Any]],
    prior_rows_newest_first: list[dict[str, Any]],
    *,
    retain: int,
) -> list[dict[str, Any]]:
    """AC-1/AC-2: `new_rows_asc` come back seq-ascending from the feed;
    reverse them onto the already-newest-first retained tail, then cap at
    `retain` (default 50, tunable via `thresholds.py` -- never a literal).
    """
    merged = list(reversed(new_rows_asc)) + prior_rows_newest_first
    return merged[:retain]

"""AC-001-03: job status + committed/skipped/rejected summary."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class JobSummary:
    committed: int
    rejected: int
    skipped: int


def summarize_proposal_statuses(statuses: Sequence[str]) -> JobSummary:
    """`accepted` -> committed, `rejected` -> rejected, anything else
    (`pending`, i.e. never actioned) -> skipped once the job is terminal.
    """
    committed = sum(1 for s in statuses if s == "accepted")
    rejected = sum(1 for s in statuses if s == "rejected")
    skipped = len(statuses) - committed - rejected
    return JobSummary(committed=committed, rejected=rejected, skipped=skipped)

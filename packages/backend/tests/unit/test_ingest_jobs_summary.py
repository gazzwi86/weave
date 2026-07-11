"""CE-V1-TASK-012 unit test: AC-001-03 -- committed/skipped/rejected job
summary counts. Pure function over proposal statuses -- no DB.
"""

from __future__ import annotations

from weave_backend.ingest.jobs import summarize_proposal_statuses


def test_summarize_proposal_statuses_counts_each_bucket() -> None:
    statuses = ["accepted", "accepted", "rejected", "pending", "pending", "pending"]

    summary = summarize_proposal_statuses(statuses)

    assert summary.committed == 2
    assert summary.rejected == 1
    assert summary.skipped == 3


def test_summarize_proposal_statuses_all_zero_when_no_proposals() -> None:
    summary = summarize_proposal_statuses([])

    assert summary.committed == 0
    assert summary.rejected == 0
    assert summary.skipped == 0

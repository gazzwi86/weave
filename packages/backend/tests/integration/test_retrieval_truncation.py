"""TASK-003 (ADR-005, AC-3, EPIC-011): truncation disclosure through
`retrieve_slice`'s full seed + weighted k-hop pipeline against a
CE-stub fixture graph. No real infra needed (`retrieve_slice` never
touches Postgres/CE directly -- `neighbours_fn` is the injected boundary,
Law F) -- marked `integration` (not `docker`) since it exercises the
pipeline end-to-end rather than one scoring unit, matching the task
brief's AC-to-Test Mapping.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

import pytest

from weave_backend.build.retrieval import RetrievalConfig, retrieve_slice

pytestmark = pytest.mark.integration

_STRUCTURAL = "urn:weave:bpmo:hasStep"


def _ce_stub_neighbours(
    edges_by_src: dict[str, list[tuple[str, str, str]]],
) -> Callable[[list[str]], Awaitable[list[tuple[str, str, str]]]]:
    async def _neighbours(frontier: list[str]) -> list[tuple[str, str, str]]:
        out: list[tuple[str, str, str]] = []
        for src in frontier:
            out.extend(edges_by_src.get(src, []))
        return out

    return _neighbours


@pytest.mark.asyncio
async def test_should_disclose_truncation_in_run_log_and_prompt(
    caplog: pytest.LogCaptureFixture,
) -> None:
    seed = "urn:process:onboarding"
    # 220 directly-reachable steps -- a fixture graph well past the
    # 200-node cap (seed + 220 candidates).
    edges = {seed: [(seed, _STRUCTURAL, f"urn:step{i:04d}") for i in range(220)]}
    cfg = RetrievalConfig(
        weights={"structural": 1.0, "associative": 0.5, "annotation": 0.1}, max_hops=2
    )

    with caplog.at_level(logging.INFO):
        result = await retrieve_slice(
            seed_iris=[seed], neighbours_fn=_ce_stub_neighbours(edges), cfg=cfg
        )

    # run log: greppable "retrieval_truncated" event with the dropped count.
    truncation_logs = [r for r in caplog.records if r.message == "retrieval_truncated"]
    assert len(truncation_logs) == 1
    assert truncation_logs[0].__dict__["dropped"] == 21  # 221 candidates - 200 cap

    # prompt preamble: the notice states both the dropped count and that
    # the investigator escape hatch exists (discoverability, Implementation
    # Hints).
    assert result.truncated is True
    assert result.notice is not None
    assert "21" in result.notice
    assert "investigator" in result.notice.lower()

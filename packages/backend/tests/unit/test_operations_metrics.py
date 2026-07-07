"""Unit tests for `operations/metrics.py`'s fire-and-forget scheduler
(ADR-004): the CE write path calls `schedule_mutation_outcome_metric`, not
`await emit_mutation_outcome_metric`, so the CloudWatch round trip never sits
on the write critical path. These tests pin that contract so a future edit
can't silently reintroduce an inline await.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import metrics


async def test_schedule_mutation_outcome_metric_does_not_await_the_emit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_emit = AsyncMock(return_value=None)
    monkeypatch.setattr(metrics, "emit_mutation_outcome_metric", mock_emit)

    metrics.schedule_mutation_outcome_metric("success")

    # Returns before the emit's body runs -- proves it's scheduled, not awaited.
    mock_emit.assert_not_awaited()
    assert metrics._background_tasks

    await asyncio.sleep(0)
    mock_emit.assert_awaited_once_with("success")


def test_schedule_mutation_outcome_metric_without_a_running_loop_is_a_noop() -> None:
    # No event loop running here (sync test) -- must not raise.
    metrics.schedule_mutation_outcome_metric("violation")

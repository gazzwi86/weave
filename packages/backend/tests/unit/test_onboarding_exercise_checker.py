"""TASK-009 AC-009-01/03/06: checker dispatch per completion kind (unknown
kind rejected) + the path x variant gating matrix. No docker/Postgres --
`run_query` is monkeypatched for the sparql_ask path.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.onboarding.exercise_checker import (
    UnsupportedCompletionKindError,
    check_completion,
)
from weave_backend.onboarding.exercises import EXERCISES, gate_exercise


async def test_sparql_ask_dispatches_to_run_query_and_reports_true_result() -> None:
    completion = EXERCISES["CE-02"]["completion"]
    with patch(
        "weave_backend.onboarding.exercise_checker.run_query",
        new=AsyncMock(return_value={"boolean": True}),
    ) as mock_run_query:
        outcome = await check_completion(
            completion, named_graph_iri="urn:ws:1", claimed_signals=frozenset()
        )
    assert outcome.verified is True
    assert outcome.verified_signal == "ask"
    mock_run_query.assert_awaited_once_with(completion["ask"], "urn:ws:1")


async def test_sparql_ask_reports_false_when_ask_returns_false() -> None:
    completion = EXERCISES["CE-03"]["completion"]
    with patch(
        "weave_backend.onboarding.exercise_checker.run_query",
        new=AsyncMock(return_value={"boolean": False}),
    ):
        outcome = await check_completion(
            completion, named_graph_iri="urn:ws:1", claimed_signals=frozenset()
        )
    assert outcome.verified is False


async def test_sparql_ask_without_named_graph_raises() -> None:
    completion = EXERCISES["CE-02"]["completion"]
    with pytest.raises(ValueError):
        await check_completion(completion, named_graph_iri=None, claimed_signals=frozenset())


@pytest.mark.parametrize(
    ("claimed", "expected"),
    [
        (frozenset({"entity-list-viewed", "missing-property-viewed"}), True),
        (frozenset({"entity-list-viewed"}), False),
        (frozenset(), False),
    ],
)
async def test_nav_signal_requires_all_required_signals(
    claimed: frozenset[str], expected: bool
) -> None:
    completion = EXERCISES["CE-01"]["completion"]
    outcome = await check_completion(completion, named_graph_iri=None, claimed_signals=claimed)
    assert outcome.verified is expected
    assert outcome.verified_signal == "nav_signal"


async def test_canvas_state_verified_when_claimed_state_matches() -> None:
    completion = EXERCISES["GE-01"]["completion"]
    verified_true = await check_completion(
        completion, named_graph_iri=None, claimed_signals=frozenset({"spotlight-active"})
    )
    verified_false = await check_completion(
        completion, named_graph_iri=None, claimed_signals=frozenset({"something-else"})
    )
    assert verified_true.verified is True
    assert verified_false.verified is False
    assert verified_true.verified_signal == "canvas_state"


async def test_unknown_completion_kind_rejected() -> None:
    bogus: Any = {"kind": "write_commit"}
    with pytest.raises(UnsupportedCompletionKindError):
        await check_completion(bogus, named_graph_iri=None, claimed_signals=frozenset())


# --- gating matrix (AC-009-01/06) -------------------------------------------


@pytest.mark.parametrize(
    ("exercise_id", "role_path", "variant", "expected_available", "expected_reason"),
    [
        ("CE-01", "business", "default", True, None),
        ("CE-03", "technical", "default", True, None),
        ("CE-03", "business", "default", False, "path_gated"),
        ("CE-03b", "business", "default", True, None),
        ("CE-03b", "technical", "default", False, "path_gated"),
        ("CE-02", "business", "read_only", False, "read_only_locked"),
        ("CE-01", "business", "read_only", True, None),
        ("nonexistent", "business", "default", False, "unknown_exercise"),
    ],
)
def test_gate_exercise_matrix(
    exercise_id: str,
    role_path: str,
    variant: str,
    expected_available: bool,
    expected_reason: str | None,
) -> None:
    result = gate_exercise(exercise_id, role_path=role_path, path_variant=variant)  # type: ignore[arg-type]
    assert result.available is expected_available
    assert result.reason == expected_reason

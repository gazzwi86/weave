"""BE-V1-TASK-021 (FR-065) unit tests: pure prompt-text validation (AC-6)
and the `_synthesise_prompt_briefs` orchestrator step (AC-7/AC-8), against
a fake connection -- same `_FakeConnection` pattern as
`tests/unit/test_orchestrator.py`. Router-level 202/403/DB wiring is
proven in `tests/integration/test_prompts_api.py` (Law B).
"""

from __future__ import annotations

from typing import Any

from weave_backend.build.hitl import HitlGateContext
from weave_backend.build.orchestrator import OrchestratorDeps, _synthesise_prompt_briefs
from weave_backend.build.state_spine import StateSpine, TaskState
from weave_backend.routers.prompts import DEFAULT_PROMPT_MAX_LENGTH, prompt_text_valid

_TENANT = "tenant-prompt"
_PROJECT_IRI = f"urn:weave:project:{_TENANT}:acme"


class _FakeConnection:
    """Only the calls `_synthesise_prompt_briefs` makes: `task_briefs`
    insert (`fetchrow`) and `gate_results` insert (`execute`) -- both
    best-effort no-ops for this unit test's purposes.
    """

    async def fetchrow(self, query: str, *_args: Any) -> dict[str, Any] | None:
        if "task_briefs" in query:
            return {"created_at": None}
        if "audit_entries" in query:
            return None
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def execute(self, query: str, *_args: Any) -> None:
        return None


def _valid_brief_content() -> dict[str, Any]:
    return {
        "title": "change error message",
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "WHEN x THEN y", "test_mapping": "t1"}
        ],
        "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "t1"}],
        "dep_chain": {"blocked_by": [], "unlocks": []},
        "cost_estimate": {
            "complexity": "S",
            "estimated_tokens_input_k": 1.0,
            "estimated_tokens_output_k": 1.0,
            "estimated_cost_usd": 0.1,
        },
        "design_decisions": ["reuse existing endpoint"],
    }


def _spine(**overrides: Any) -> StateSpine:
    fields: dict[str, Any] = {
        "project_iri": _PROJECT_IRI,
        "tenant_id": _TENANT,
        "run_id": "run-1",
        "turn_cap": 10,
        "trigger": "prompt",
        "prompt_context": {"prompt_id": "p-1", "prompt_text": "change error message"},
    }
    fields.update(overrides)
    return StateSpine(**fields)


def test_reject_empty_or_oversized_prompt() -> None:
    """AC-6."""
    assert not prompt_text_valid("", max_length=DEFAULT_PROMPT_MAX_LENGTH)
    assert not prompt_text_valid("   ", max_length=DEFAULT_PROMPT_MAX_LENGTH)
    assert not prompt_text_valid("x" * (DEFAULT_PROMPT_MAX_LENGTH + 1), max_length=DEFAULT_PROMPT_MAX_LENGTH)
    assert prompt_text_valid("fix this inaccuracy", max_length=DEFAULT_PROMPT_MAX_LENGTH)


async def test_non_prompt_trigger_run_is_untouched_by_synthesis() -> None:
    """AC-5's building block: a `trigger="request"` run must never take
    the brief-synthesis branch -- no prompt-specific bypass/detour exists.
    """
    spine = _spine(trigger="request", prompt_context=None)
    deps = OrchestratorDeps(synthesise_briefs_fn=_unreachable_synthesise)

    halted = await _synthesise_prompt_briefs(_FakeConnection(), spine, tenant_id=_TENANT, deps=deps)

    assert halted is False
    assert spine.tasks == []


async def _unreachable_synthesise(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
    raise AssertionError("synthesise_briefs_fn must not be called for a request-triggered run")



async def test_synthesise_typed_brief_from_prompt_before_delegate() -> None:
    """AC-7: a READY-gated synthesised brief is appended as a dispatchable
    Ready task -- the raw prompt text is never what downstream reads.
    """
    spine = _spine()

    async def _synthesise(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
        return [_valid_brief_content()]

    deps = OrchestratorDeps(synthesise_briefs_fn=_synthesise)

    halted = await _synthesise_prompt_briefs(
        _FakeConnection(), spine, tenant_id=_TENANT, deps=deps
    )

    assert halted is False
    assert len(spine.tasks) == 1
    assert spine.tasks[0].status == "Ready"
    assert spine.tasks[0].hold_reason is None



async def test_hold_prompt_run_when_synthesised_brief_fails_dor() -> None:
    """AC-8: a brief missing the AC-to-test map fails DoR -- the task holds
    in Ready with "brief incomplete" and the run routes to HITL, never
    dispatching the raw prompt to the Engineer."""
    spine = _spine()
    incomplete = _valid_brief_content()
    del incomplete["ac_to_test_map"]

    async def _synthesise(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
        return [incomplete]

    fired: list[HitlGateContext] = []

    async def _fire_hitl(_conn: Any, ctx: HitlGateContext) -> None:
        fired.append(ctx)

    deps = OrchestratorDeps(synthesise_briefs_fn=_synthesise, fire_hitl_gate_fn=_fire_hitl)

    halted = await _synthesise_prompt_briefs(
        _FakeConnection(), spine, tenant_id=_TENANT, deps=deps
    )

    assert halted is True
    assert spine.phase == "halted_hitl"
    assert len(spine.tasks) == 1
    task: TaskState = spine.tasks[0]
    assert task.status == "Ready"
    assert task.hold_reason == "brief incomplete"
    assert len(fired) == 1
    assert fired[0].evidence == "brief_incomplete"

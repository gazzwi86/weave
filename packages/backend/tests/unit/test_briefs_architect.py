"""BE-TASK-002 unit tests: Architect agent orchestration (AC-1/AC-6).
`test_architect_uses_confirmed_model_ids` and
`test_architect_returns_valid_brief_schema` are the brief's own literal
AC-6/AC-1 test names.
"""

from __future__ import annotations

import json

import pytest

from weave_backend.briefs.architect import ModelRoutingMiss, draft_brief_document
from weave_backend.briefs.schema import TaskBrief

_VALID_RAW_BRIEF = {
    "schema_version": "1.0",
    "task_id": "task-1",
    "project_iri": "urn:weave:project:t1:acme",
    "title": "Do the thing",
    "user_story": "As a user I want the thing so that value",
    "acceptance_criteria": [
        {"id": "AC-1", "criterion": "WHEN X THE SYSTEM SHALL Y", "test_mapping": "test_x"}
    ],
    "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_x"}],
    "dor_checklist": ["User story clear"],
    "dod_checklist": ["All AC met"],
    "dep_chain": {"blocked_by": [], "unlocks": []},
    "cost_estimate": {
        "complexity": "S",
        "estimated_tokens_input_k": 1,
        "estimated_tokens_output_k": 1,
        "estimated_cost_usd": 0.1,
    },
    "generated_at": "2026-07-04T00:00:00Z",
}


class _RecordingProvider:
    def __init__(self, draft_response: str) -> None:
        self.calls: list[tuple[str, str]] = []
        self._draft_response = draft_response

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        self.calls.append((model_id, prompt))
        return self._draft_response


def test_architect_returns_valid_brief_schema() -> None:
    provider = _RecordingProvider(json.dumps(_VALID_RAW_BRIEF))

    raw_brief = draft_brief_document(
        "Do the thing", {"nodes": []}, [], provider=provider
    )

    validated = TaskBrief.model_validate(raw_brief)
    assert validated.title == "Do the thing"


def test_architect_uses_confirmed_model_ids() -> None:
    provider = _RecordingProvider(json.dumps(_VALID_RAW_BRIEF))

    draft_brief_document("Do the thing", {"nodes": []}, [], provider=provider)

    model_ids_used = [model_id for model_id, _prompt in provider.calls]
    assert model_ids_used == ["claude-fable-5", "claude-sonnet-5"]


def test_architect_halts_and_raises_on_routing_miss(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("weave_backend.briefs.architect._DRAFT_TIER", "opus")
    provider = _RecordingProvider(json.dumps(_VALID_RAW_BRIEF))

    with pytest.raises(ModelRoutingMiss) as exc_info:
        draft_brief_document("Do the thing", {"nodes": []}, [], provider=provider)

    assert exc_info.value.tier == "opus"

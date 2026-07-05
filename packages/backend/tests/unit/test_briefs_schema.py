"""BE-TASK-002 unit tests: the `TaskBrief` document schema itself (AC-2) --
EARS wording on every AC, at least one AC, and every AC id covered by
`ac_to_test_map`, all enforced by Pydantic before a brief is ever persisted.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from weave_backend.briefs.schema import CostEstimate, DepChain, EarsAC, TaskBrief


def _valid_brief_kwargs() -> dict[str, object]:
    return {
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
        "generated_at": datetime.now(UTC),
    }


def test_valid_task_brief_document_parses() -> None:
    brief = TaskBrief.model_validate(_valid_brief_kwargs())

    assert brief.schema_version == "1.0"
    assert brief.acceptance_criteria[0].id == "AC-1"
    assert brief.design_tokens is None


def test_ears_ac_criterion_must_start_with_when() -> None:
    with pytest.raises(ValidationError):
        EarsAC(id="AC-1", criterion="Do the thing", test_mapping="test_x")


def test_task_brief_rejects_empty_acceptance_criteria_list() -> None:
    kwargs = _valid_brief_kwargs()
    kwargs["acceptance_criteria"] = []

    with pytest.raises(ValidationError):
        TaskBrief.model_validate(kwargs)


def test_task_brief_missing_acceptance_criteria_field_raises_422able_error() -> None:
    """AC-2: the field is required -- omitting it entirely (not just an
    empty list) is what the brief's `test_architect_rejects_brief_missing_ears_acs`
    scenario exercises at the router.
    """
    kwargs = _valid_brief_kwargs()
    del kwargs["acceptance_criteria"]

    with pytest.raises(ValidationError) as exc_info:
        TaskBrief.model_validate(kwargs)

    missing_fields = {str(err["loc"][-1]) for err in exc_info.value.errors()}
    assert "acceptance_criteria" in missing_fields


def test_task_brief_rejects_ac_id_absent_from_ac_to_test_map() -> None:
    kwargs = _valid_brief_kwargs()
    kwargs["ac_to_test_map"] = [{"ac_id": "AC-2", "test_name": "test_other"}]

    with pytest.raises(ValidationError, match="AC-1"):
        TaskBrief.model_validate(kwargs)


def test_dep_chain_and_cost_estimate_are_typed_submodels() -> None:
    brief = TaskBrief.model_validate(_valid_brief_kwargs())

    assert isinstance(brief.dep_chain, DepChain)
    assert isinstance(brief.cost_estimate, CostEstimate)
    assert brief.cost_estimate.complexity == "S"

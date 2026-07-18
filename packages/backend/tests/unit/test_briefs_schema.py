"""BE-TASK-002 unit tests: the `TaskBrief` document schema itself (AC-2) --
EARS wording on every AC, at least one AC, and every AC id covered by
`ac_to_test_map`, all enforced by Pydantic before a brief is ever persisted.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

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


def test_epic_id_and_title_are_optional_and_default_to_none() -> None:
    """G9 (docs/design/remediation-2-api-gaps.md): additive, optional
    fields -- same no-migration precedent as `adr_refs` (`content` is
    JSONB) -- so a brief with no epic association still parses.
    """
    brief = TaskBrief.model_validate(_valid_brief_kwargs())

    assert brief.epic_id is None
    assert brief.epic_title is None


def test_epic_id_and_title_round_trip_when_provided() -> None:
    kwargs = _valid_brief_kwargs()
    kwargs["epic_id"] = "EPIC-004"
    kwargs["epic_title"] = "Build dashboard"

    brief = TaskBrief.model_validate(kwargs)

    assert brief.epic_id == "EPIC-004"
    assert brief.epic_title == "Build dashboard"


def test_dep_chain_and_cost_estimate_are_typed_submodels() -> None:
    brief = TaskBrief.model_validate(_valid_brief_kwargs())

    assert isinstance(brief.dep_chain, DepChain)
    assert isinstance(brief.cost_estimate, CostEstimate)
    assert brief.cost_estimate.complexity == "S"


def test_cost_estimate_accepts_xl_complexity() -> None:
    """QA edge case: the task brief's own pseudocode specifies
    ``Literal["S", "M", "L", "XL"]`` for ``CostEstimate.complexity``, but
    the shipped schema only allows ``Literal["S", "M", "L"]`` -- an XL-rated
    brief (the brief's own cost-estimate table uses "L" for this very task,
    but the schema must still accept the full spec'd range) is incorrectly
    rejected. Currently RED -- see QA report BE-TASK-002.
    """
    kwargs = _valid_brief_kwargs()
    cost_estimate = cast(dict[str, object], kwargs["cost_estimate"])
    cost_estimate["complexity"] = "XL"

    brief = TaskBrief.model_validate(kwargs)

    assert brief.cost_estimate.complexity == "XL"

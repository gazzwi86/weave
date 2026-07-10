"""Law 13: request/response schemas for `POST /api/tasks/{task_id}/result`
and `POST /api/tasks/{task_id}/hitl` (BE-TASK-005, build-engine EPIC-006).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, model_validator

FailureClass = Literal["logic", "syntax", "dependency", "spec_ambiguity"]


class DispatchUsage(BaseModel):
    """TASK-012 (ADR-008): the Agent SDK usage block a dispatch returns,
    scoped to the role/model that ran. Optional on `TypedResult` -- `None`
    for dispatches with no attributable spend (e.g. the current no-op PDAC
    stub, TASK-007/008 not yet built), so `build/cost.py`'s wrap point never
    fabricates a `cost_events` row for work that burned no tokens.
    """

    agent_role: str
    model: str
    tokens_in: int
    tokens_out: int


class SelfVerificationLine(BaseModel):
    """BE-TASK-006 AC-4/AC-5 (build-engine EPIC-011): one applicable rule's
    self-reported compliance status, part of the agent's handoff record.
    """

    rule: str
    status: Literal["complied", "violated", "n/a"]
    note: str = ""


class TypedResult(BaseModel):
    status: Literal["PASS", "FAIL"]
    failure_class: FailureClass | None = None
    evidence: str | None = None
    retry_recommended: bool
    usage: DispatchUsage | None = None
    self_verification: list[SelfVerificationLine] | None = None

    @model_validator(mode="after")
    def _require_failure_class_on_fail(self) -> TypedResult:
        if self.status == "FAIL" and self.failure_class is None:
            msg = "failure_class is required when status is FAIL"
            raise ValueError(msg)
        return self


class AgentResultResponse(BaseModel):
    action: Literal["proceed", "retry", "hitl_gate"]
    retry_count: int | None = None


class HitlActionRequest(BaseModel):
    action: Literal["approve", "reject", "amend"]
    amendment: str | None = None

    @model_validator(mode="after")
    def _require_amendment_on_amend(self) -> HitlActionRequest:
        if self.action == "amend" and not (self.amendment or "").strip():
            msg = "amendment is required when action is amend"
            raise ValueError(msg)
        return self


class HitlActionResponse(BaseModel):
    action: Literal["resumed", "halted", "replan"]

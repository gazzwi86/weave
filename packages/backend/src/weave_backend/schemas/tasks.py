"""Law 13: request/response schemas for `POST /api/tasks/{task_id}/result`
and `POST /api/tasks/{task_id}/hitl` (BE-TASK-005, build-engine EPIC-006).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, model_validator

FailureClass = Literal["logic", "syntax", "dependency", "spec_ambiguity"]


class TypedResult(BaseModel):
    status: Literal["PASS", "FAIL"]
    failure_class: FailureClass | None = None
    evidence: str | None = None
    retry_recommended: bool

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

"""Response DTOs for `/api/tasks/{task_id}/gates/dor`,
`/api/tasks/{task_id}/gates/dod`, `/api/projects/{project_iri}/gates/pre-scaffold`
(BE-TASK-007, build-engine EPIC-012). `response_model` projection is what
keeps the DoD gate's internal `evidence` field (audit-only) out of the
wire response -- `CommandResult` declares only `name`/`status`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DorGateResponse(BaseModel):
    gate: Literal["DoR"]
    result: Literal["READY", "NOT_READY"]
    failing_checks: list[str] | None = None


class CommandResult(BaseModel):
    name: str
    status: Literal["PASS", "FAIL", "NOT_VERIFIED"]


class DodGateResponse(BaseModel):
    gate: Literal["DoD"]
    result: Literal["PASS", "FAIL"]
    commands: list[CommandResult]


class PreScaffoldFinding(BaseModel):
    step: str
    reason: str
    critical: bool = False


class PreScaffoldGateResponse(BaseModel):
    """TASK-009/FR-055: `result` gains `"BLOCKED"`; `failing_step` is new
    and only set on a BLOCKED response (M1 shape otherwise unchanged --
    Design Decisions).
    """

    gate: Literal["pre_scaffold"]
    result: Literal["PROCEED", "BLOCKED"]
    findings: list[PreScaffoldFinding]
    failing_step: str | None = None

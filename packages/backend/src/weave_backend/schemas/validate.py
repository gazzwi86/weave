"""Wire DTOs for CE-TASK-006 `GET /api/validate` (FR-027, m2-delta.md §7).

Two response shapes, never blended: `ValidationPending` (AC-006-04 -- "never
stale counts and never an empty state readable as no violations") or
`ValidationReport` (AC-006-01/-03). `ValidationReport.rules` has NO possible
representation for "not yet run" -- an empty `results` list still carries a
real `ran_at`/`version_resolved`, so a caller can never mistake a genuinely
clean report for a pending one (the type itself is the AC-006-04 guarantee,
not a runtime flag callers could forget to check).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ValidationResultEntry(BaseModel):
    shape_iri: str
    focus_node: str
    path: str | None
    message: str
    severity: Literal["Violation", "Warning", "Info", "Unknown"]


class RuleCoverage(BaseModel):
    """AC-006-03: one row per modelled shape, framework or tenant --
    including shapes with zero current violations (a clean shape is still
    a covered rule, not an absent one). No `violating_entities` list here
    (implementation hint: don't duplicate the eager per-rule entity list
    into the report payload) -- `ValidationReport.results` already carries
    every violation's `shape_iri` + `focus_node`, so the UI derives and
    paginates a rule's entities client-side by filtering `results`, at
    zero extra network cost."""

    shape_iri: str
    severity: Literal["Violation", "Warning", "Info", "Unknown"]
    description: str
    origin: Literal["framework", "tenant"]
    violation_count: int


class ValidationReport(BaseModel):
    pending: Literal[False] = False
    results: list[ValidationResultEntry]
    rules: list[RuleCoverage]
    ran_at: datetime
    version_resolved: str


class ValidationPending(BaseModel):
    """AC-006-04: no report has been run yet against the current
    shapes+data state (draft moved, or a tenant shape changed, since the
    last cached run)."""

    pending: Literal[True] = True

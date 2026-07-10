"""TASK-001 AC-3: the effective-set overlay -- ADR-007 §3, whole-key
override, never a prose merge. Pure given two lists (implementation hint) --
no DB, no HTTP.
"""

from __future__ import annotations

from weave_backend.standards.models import StandardRecord

_ACTIVE_STATUS = "active"


def effective_set(
    company: list[StandardRecord], project: list[StandardRecord]
) -> list[StandardRecord]:
    """AC-3: same-`standard_key` project-scope documents win whole-key over
    company-scope; draft/retired documents never appear (defence in depth
    alongside the `status='active'` DB-query filter callers are expected to
    apply -- see `standards/store.py`'s `list_standards`).
    """
    merged: dict[str, StandardRecord] = {
        s.standard_key: s for s in company if s.status == _ACTIVE_STATUS
    }
    merged.update({s.standard_key: s for s in project if s.status == _ACTIVE_STATUS})
    return sorted(merged.values(), key=lambda s: s.standard_key)

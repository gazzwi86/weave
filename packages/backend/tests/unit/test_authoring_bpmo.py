"""TASK-004 unit tests: BPMO 13-kind membership guard (AC-004-02).

Enforced at ingestion (this module), *before* any op reaches CE-WRITE-1 --
so a rejected kind never round-trips through the SHACL pipeline at all
(design decision: "BPMO 13-kind constraint enforced at ingestion, not only
SHACL").
"""

from __future__ import annotations

import pytest

from weave_backend.authoring.bpmo import BPMO_KINDS, InvalidBpmoKindError, validate_kind

_VALID_KINDS = (
    "Process",
    "Activity",
    "Event",
    "DataAsset",
    "Field",
    "System",
    "Service",
    "BusinessCapability",
    "BusinessDomain",
    "Policy",
    "Goal",
    "Actor",
    "Concept",
    "Class",
)

_INVALID_KINDS = ("Widget", "Table", "Person", "Document", "Task")


def test_bpmo_kinds_matches_the_task_briefs_enumerated_kind_list() -> None:
    """AC-004-02 enumerates 14 names (Process..Class) but its own prose
    calls it "the 13 BPMO kinds" -- a brief miscount (Concept/Class are
    each real, distinct entries in the enumeration; decision B1's "punned
    resource" note describes how *every* kind is dual-typed, not that
    these two collapse into one). The enumerated list is the more specific
    source, so it wins; flagged in the task's progress summary.
    """
    assert frozenset(_VALID_KINDS) == BPMO_KINDS


@pytest.mark.parametrize("kind", _VALID_KINDS)
def test_validate_kind_accepts_every_valid_bpmo_kind(kind: str) -> None:
    validate_kind(kind)  # must not raise


@pytest.mark.parametrize("kind", _INVALID_KINDS)
def test_validate_kind_rejects_kinds_outside_the_thirteen(kind: str) -> None:
    with pytest.raises(InvalidBpmoKindError):
        validate_kind(kind)


def test_validate_kind_is_case_sensitive_not_silently_normalised() -> None:
    """A near-miss casing ("process") is a rejection, not a silent
    normalisation -- the caller must resolve to the exact kind name.
    """
    with pytest.raises(InvalidBpmoKindError):
        validate_kind("process")


def test_invalid_kind_error_names_the_offending_kind() -> None:
    with pytest.raises(InvalidBpmoKindError, match="Widget"):
        validate_kind("Widget")

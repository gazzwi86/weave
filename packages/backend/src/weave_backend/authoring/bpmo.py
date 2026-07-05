"""TASK-004 AC-004-02: BPMO 13-kind membership guard.

Enforced here, at ingestion -- before any NL-parsed, form-submitted, or
imported class definition becomes a CE-WRITE-1 `add_node` op. This is a
platform-level constraint, not a SHACL rule (design decision: earlier
rejection is better UX than a generic 422). The canonical kind list is
served live by `GET /api/ontology/types` once `framework.shacl.ttl` carries
a shape per kind (`ontology/catalogue.py`) -- this frozenset is this
task's authoritative mirror of that same 13-kind set (`ontology-standards.md`:
never a *hand-copied* list elsewhere in the codebase; here it is the source
that the SHACL shapes and the guard both trace back to).
"""

from __future__ import annotations

BPMO_KINDS: frozenset[str] = frozenset(
    {
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
    }
)


class InvalidBpmoKindError(Exception):
    """Raised when a proposed class `kind` is not one of the 13 BPMO kinds."""

    def __init__(self, kind: str) -> None:
        allowed = sorted(BPMO_KINDS)
        super().__init__(f"{kind!r} is not a valid BPMO kind (must be one of {allowed})")
        self.kind = kind


def validate_kind(kind: str) -> None:
    """Raises `InvalidBpmoKindError` unless `kind` is exactly one of the 13
    BPMO kinds (case-sensitive -- no silent normalisation of near-misses).
    """
    if kind not in BPMO_KINDS:
        raise InvalidBpmoKindError(kind)

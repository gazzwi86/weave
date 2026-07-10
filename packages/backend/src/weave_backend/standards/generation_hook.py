"""TASK-001 AC-4/AC-5: the E8-S1 generation-context hook -- absence
degrades to the M1 demo-default stack (never halts), and `stack_pins` drive
stack selection when present. A genuine cross-key conflict on the same axis
is never resolved by sort-order (implementation hint): it is reported as a
named `StandardsConflictError` and that one axis falls back to demo-default,
while every non-conflicting axis still resolves.
"""

from __future__ import annotations

from dataclasses import dataclass

from weave_backend.standards.models import StandardRecord


class StandardsConflictError(Exception):
    """Two effective-set documents pin different values for the same
    `stack_pins` axis -- carried as data (`build_context_addendum`'s
    `conflicts` tuple), not raised/propagated, since a conflict on one axis
    must not halt generation or block the other, non-conflicting axes.
    """

    def __init__(self, axis: str, values: tuple[str, str]) -> None:
        self.axis = axis
        self.values = values
        super().__init__(f"conflicting stack pin for axis {axis!r}: {values}")


@dataclass(frozen=True)
class StackResolution:
    pins: dict[str, str]
    conflicts: tuple[StandardsConflictError, ...]


def resolve_stack_pins(standards: list[StandardRecord]) -> StackResolution:
    """AC-5: merge `stack_pins` across the effective set, sorted by
    `standard_key` for determinism. A conflicting axis (two different docs
    pinning different values) is dropped from `pins` and recorded in
    `conflicts` instead of letting sort order silently pick a winner.
    """
    pins: dict[str, str] = {}
    conflicts: list[StandardsConflictError] = []
    conflicting_axes: set[str] = set()
    for doc in sorted(standards, key=lambda s: s.standard_key):
        for axis, value in (doc.stack_pins or {}).items():
            if axis in conflicting_axes:
                continue
            if axis in pins and pins[axis] != value:
                conflicts.append(StandardsConflictError(axis, (pins[axis], value)))
                conflicting_axes.add(axis)
                del pins[axis]
                continue
            pins[axis] = value
    return StackResolution(pins=pins, conflicts=tuple(conflicts))


def render_standards_section(standards: list[StandardRecord]) -> str:
    """Renders the effective set as prose for the generation prompt --
    concatenation only (ADR-007 §3: no section merging)."""
    sections = sorted(standards, key=lambda s: s.standard_key)
    return "\n\n".join(f"## {s.standard_key}\n{s.body_md}" for s in sections)


@dataclass(frozen=True)
class GenerationContextAddendum:
    standards_missing: bool
    standards_section: str | None
    stack_pins: dict[str, str] | None
    conflicts: tuple[StandardsConflictError, ...]


def build_context_addendum(standards: list[StandardRecord]) -> GenerationContextAddendum:
    """AC-4: an empty effective set degrades to the M1 demo-default stack
    (`standards_missing=True`, everything else `None`) -- absence is a
    warning, never a halt. AC-5: a non-empty set injects rendered prose plus
    resolved `stack_pins` (conflicting axes excluded, see
    `resolve_stack_pins`).
    """
    if not standards:
        return GenerationContextAddendum(
            standards_missing=True, standards_section=None, stack_pins=None, conflicts=()
        )
    resolution = resolve_stack_pins(standards)
    return GenerationContextAddendum(
        standards_missing=False,
        standards_section=render_standards_section(standards),
        stack_pins=resolution.pins or None,
        conflicts=resolution.conflicts,
    )

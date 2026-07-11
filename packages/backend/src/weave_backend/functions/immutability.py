"""CE-FUNCTION-1 (AC-009-04): request-only classification of whether an
apply's operations touch a `weave:Function` signature -- no graph fetch.

Mirrors the existing `PublishedTargetError` fast-reject path in
`operations/pipeline.py`, which must reject a published target *before* any
graph I/O (see `test_operations_pipeline_published_target.py`). This check
runs alongside it, purely off the request body, to decide 422
(function-signature-specific) vs the generic 409.
"""

from __future__ import annotations

from collections.abc import Sequence

from weave_backend.operations.graph_ops import WEAVE, _expand
from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp, Op

#: Edges that define a function's signature (ADR-009: boundKind + ordered
#: params + return). Any op naming one of these predicates against a
#: published target is an in-place signature edit, not a label/description
#: tweak.
_SIGNATURE_PREDICATES = {WEAVE.boundKind, WEAVE.hasParameter, WEAVE.hasReturn}


def touches_function_signature(operations: Sequence[Op]) -> bool:
    for op in operations:
        if isinstance(op, AddEdgeOp) and _expand(op.predicate) in _SIGNATURE_PREDICATES:
            return True
        if isinstance(op, AddNodeOp) and _expand(op.kind) == WEAVE.Function:
            return True
    return False


def existing_signature_edit_targets(operations: Sequence[Op]) -> set[str]:
    """AC-009-04: subject IRIs of signature-predicate edges that name a node
    NOT created in this same batch -- i.e. a candidate in-place edit of an
    already-existing function. `graph_ops._resolve_ref` treats any
    `subject_ref` absent from the batch's local `AddNodeOp.ref`s as a
    literal, pre-existing IRI (same resolution rule the apply pipeline
    itself uses), so this reuses that exact distinction to tell "defining a
    brand-new function" (AC-009-01, never flagged) apart from "editing a
    published one in place" (AC-009-04). Whether a candidate is actually a
    *published* `weave:Function` is a graph question the pipeline resolves
    separately (a cheap ASK against the latest published version graph).
    """
    local_refs = {op.ref for op in operations if isinstance(op, AddNodeOp)}
    return {
        op.subject_ref
        for op in operations
        if isinstance(op, AddEdgeOp)
        and _expand(op.predicate) in _SIGNATURE_PREDICATES
        and op.subject_ref not in local_refs
    }

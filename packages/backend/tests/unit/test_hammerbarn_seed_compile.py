"""Unit tests for `onboarding/hammerbarn_seed/compile.py` (TASK-002
AC-002-01/-02): kind validation against a caller-supplied allowed set (no
hand-coded kind list), and compile determinism.
"""

from __future__ import annotations

import pytest

from weave_backend.onboarding.hammerbarn_seed import content
from weave_backend.onboarding.hammerbarn_seed.compile import (
    UnknownKindError,
    allowed_kinds_from_ontology_types,
    compile_seed,
)
from weave_backend.ontology import catalogue
from weave_backend.schemas.operations import AddNodeOp


def _real_allowed_kinds() -> set[str]:
    """Same shape `GET /api/ontology/types` (CE-READ-1) would return, built
    from the same SHACL-shapes source without needing a running server.
    """
    kinds = catalogue.list_kinds()
    body = {"kinds": [{"iri": k.iri} for k in kinds]}
    return allowed_kinds_from_ontology_types(body)


def test_compile_against_real_ontology_types_succeeds() -> None:
    allowed_kinds = _real_allowed_kinds()

    artefact = compile_seed(allowed_kinds=allowed_kinds)

    assert artefact.semver == "1.0.0"
    assert len(artefact.batches) > 0
    total_ops = sum(len(batch) for batch in artefact.batches)
    assert total_ops == len(content.node_ops()) + len(content.edge_ops())


def test_compile_is_deterministic_byte_identical() -> None:
    allowed_kinds = _real_allowed_kinds()

    first = compile_seed(allowed_kinds=allowed_kinds)
    second = compile_seed(allowed_kinds=allowed_kinds)

    assert first.to_json() == second.to_json()


def test_compile_rejects_unknown_kind(monkeypatch: pytest.MonkeyPatch) -> None:
    def _bad_node_ops() -> list[AddNodeOp]:
        return [AddNodeOp(op="add_node", ref="bogus", kind="NotARealKind", label="Bogus")]

    monkeypatch.setattr(content, "node_ops", _bad_node_ops)
    allowed_kinds = _real_allowed_kinds()

    with pytest.raises(UnknownKindError):
        compile_seed(allowed_kinds=allowed_kinds)


def test_every_content_kind_is_a_real_ontology_kind() -> None:
    """Guards against a content.py typo drifting out of sync with the real
    BPMO kind set -- would otherwise only surface via the (mocked) unknown-
    kind test above, never against the live catalogue.
    """
    allowed_kinds = _real_allowed_kinds()

    used_kinds = {op.kind for op in content.node_ops()}

    assert used_kinds <= allowed_kinds, used_kinds - allowed_kinds


def test_all_edge_refs_resolve_to_a_node_ref() -> None:
    """Ref-resolution sanity: every edge's subject_ref/object_ref names a
    ref minted by `node_ops()` -- catches a typo'd ref that would otherwise
    only surface as an opaque CE-WRITE-1 422 at apply time.
    """
    node_refs = {op.ref for op in content.node_ops()}

    for edge in content.edge_ops():
        assert edge.subject_ref in node_refs, edge.subject_ref
        assert edge.object_ref in node_refs, edge.object_ref

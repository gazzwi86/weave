"""AC-003-01 unit tests: `GET /api/ontology/types`'s kind/relationship
catalogue, introspected from the cached SHACL shapes graph -- never a
hand-copied list (ontology-standards.md), so TASK-004's fuller BPMO shape
file is picked up automatically without this module changing.
"""

from __future__ import annotations

from weave_backend.authoring.bpmo import BPMO_KINDS
from weave_backend.ontology import catalogue

_WEAVE = "https://weave.io/ontology/"


def test_list_kinds_returns_one_entry_per_shacl_node_shape() -> None:
    kinds = catalogue.list_kinds()
    kind_iris = {k.iri for k in kinds}

    # CE-TASK-001 ships exactly these 3 BPMO kinds (framework.shacl.ttl);
    # TASK-004 adds the rest without this test needing to change shape.
    assert {f"{_WEAVE}Process", f"{_WEAVE}Activity", f"{_WEAVE}Goal"} <= kind_iris


def test_list_kinds_covers_every_bpmo_kind() -> None:
    """AC-004-05: CE-READ-1's guided-form options must cover all 13 BPMO
    kinds, not just the 3 CE-TASK-001 shipped -- every kind in
    `authoring/bpmo.py::BPMO_KINDS` (the taxonomy's one source of truth)
    needs a `sh:NodeShape`/`sh:targetClass` in framework.shacl.ttl.
    """
    kind_local_names = {k.label for k in catalogue.list_kinds()}

    assert kind_local_names == set(BPMO_KINDS)


def test_list_kinds_labels_use_the_local_name() -> None:
    kinds = {k.iri: k for k in catalogue.list_kinds()}
    assert kinds[f"{_WEAVE}Process"].label == "Process"


def test_list_kinds_distinguishes_attribute_from_relationship_properties() -> None:
    kinds = {k.iri: k for k in catalogue.list_kinds()}
    process_properties = {p.path: p for p in kinds[f"{_WEAVE}Process"].properties}

    # `weave:label` has an `sh:datatype` (xsd:string) -- a literal attribute.
    assert process_properties[f"{_WEAVE}label"].is_relationship is False
    # `weave:performedBy` has `sh:class weave:Actor`, no `sh:datatype` -- a
    # relationship (object property), pointing at another node kind.
    assert process_properties[f"{_WEAVE}performedBy"].is_relationship is True


def test_list_kinds_carries_severity_and_cardinality() -> None:
    kinds = {k.iri: k for k in catalogue.list_kinds()}
    process_properties = {p.path: p for p in kinds[f"{_WEAVE}Process"].properties}
    label_shape = process_properties[f"{_WEAVE}label"]

    assert label_shape.severity == "Violation"
    assert label_shape.min_count == 1
    assert label_shape.max_count == 1


def test_list_relationships_dedups_across_kinds_by_path() -> None:
    kinds = catalogue.list_kinds()
    relationships = catalogue.list_relationships(kinds)
    paths = [r.path for r in relationships]

    assert f"{_WEAVE}performedBy" in paths
    assert len(paths) == len(set(paths))


def test_list_relationships_excludes_literal_attribute_properties() -> None:
    kinds = catalogue.list_kinds()
    relationships = catalogue.list_relationships(kinds)
    paths = {r.path for r in relationships}

    assert f"{_WEAVE}label" not in paths

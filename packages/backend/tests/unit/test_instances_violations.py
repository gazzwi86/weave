"""AC-005-03: a SHACL violation surfaced through the guided-form flow must
carry the human-readable field name (from the shape's own `sh:name`), not
just the raw predicate IRI. `catalogue.list_kinds()` reads the static
framework shapes file directly -- no docker/network needed, so this stays a
fast unit test.
"""

from __future__ import annotations

from weave_backend.instances.violations import humanize_violations
from weave_backend.schemas.operations import ViolationDetail


def test_humanize_violations_maps_known_path_to_its_shacl_name() -> None:
    violation = ViolationDetail(
        focus_node="https://weave.io/instances/process-1",
        path="https://weave.io/ontology/performedBy",
        severity="Violation",
        message="A Process must be performed by at least one Actor.",
    )
    [result] = humanize_violations([violation])
    assert result["field"] == "Performed by"
    assert result["message"] == violation.message
    assert result["severity"] == "Violation"


def test_humanize_violations_falls_back_to_local_name_for_an_unmapped_path() -> None:
    violation = ViolationDetail(
        focus_node="https://weave.io/instances/x-1",
        path="https://weave.io/ontology/somethingNotShaped",
        severity="Warning",
        message="unmapped",
    )
    [result] = humanize_violations([violation])
    assert result["field"] == "somethingNotShaped"


def test_humanize_violations_handles_a_missing_path() -> None:
    violation = ViolationDetail(
        focus_node="https://weave.io/instances/x-1",
        path=None,
        severity="Violation",
        message="node-level violation",
    )
    [result] = humanize_violations([violation])
    assert result["field"] == ""
    assert result["path"] == ""


def test_humanize_violations_preserves_order_across_multiple_violations() -> None:
    violations = [
        ViolationDetail(
            focus_node="n1",
            path="https://weave.io/ontology/performedBy",
            severity="Violation",
            message="first",
        ),
        ViolationDetail(
            focus_node="n2",
            path=None,
            severity="Violation",
            message="second",
        ),
    ]
    results = humanize_violations(violations)
    assert [r["message"] for r in results] == ["first", "second"]

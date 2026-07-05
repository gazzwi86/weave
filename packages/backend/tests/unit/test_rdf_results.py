"""CE-TASK-007 unit tests: `rdf/results.py`'s shared SPARQL-JSON-bindings ->
table-row shaping, used by both the NL query response (AC-007-01) and the
`pattern=` stored-query response (AC-007-12/-13) so both paths render the
exact same row shape in the frontend's results table.
"""

from __future__ import annotations

from weave_backend.rdf.results import bindings_to_rows


def test_bindings_to_rows_extracts_the_value_for_each_column() -> None:
    bindings = [
        {
            "s": {"type": "uri", "value": "https://weave.io/instances/p1"},
            "label": {"type": "literal", "value": "Invoicing"},
        },
    ]
    rows = bindings_to_rows(bindings, ["s", "label"])
    assert rows == [{"s": "https://weave.io/instances/p1", "label": "Invoicing"}]


def test_bindings_to_rows_omits_columns_missing_from_a_given_binding() -> None:
    """A column can be unbound (OPTIONAL) for a given row -- the row dict
    simply has no key for it, rather than a crashing KeyError.
    """
    bindings = [{"s": {"type": "uri", "value": "https://weave.io/instances/p1"}}]
    rows = bindings_to_rows(bindings, ["s", "label"])
    assert rows == [{"s": "https://weave.io/instances/p1"}]


def test_bindings_to_rows_empty_bindings_returns_empty_rows() -> None:
    assert bindings_to_rows([], ["s", "label"]) == []

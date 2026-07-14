"""CE-V1-TASK-013 gap-fix: `_kind_for_ext` must route every extension
`document_parsing.parse_simple` knows how to handle to the `doc` extractor
kind -- a missing mapping silently drops a job into the `NoOpExtractor`
fallback (zero proposals, no error) rather than failing loudly, so this is
worth a standalone regression test.
"""

from __future__ import annotations

from weave_backend.routers.ingest import _kind_for_ext


def test_markdown_extension_routes_to_the_doc_extractor_kind() -> None:
    assert _kind_for_ext("md") == "doc"


def test_markdown_extension_is_case_insensitive() -> None:
    assert _kind_for_ext("MD") == "doc"

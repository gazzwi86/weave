"""BE-TASK-001 unit tests: deterministic slug + project-IRI construction
(AC-1's `project_iri` scheme, no DB required).
"""

from __future__ import annotations

from weave_backend.projects.model import build_project_iri, slugify


def test_slugify_lowercases_and_hyphenates() -> None:
    assert slugify("Acme Corp Website") == "acme-corp-website"


def test_slugify_collapses_punctuation_into_a_single_hyphen() -> None:
    assert slugify("Acme & Co.,  Ltd!!") == "acme-co-ltd"


def test_slugify_strips_leading_and_trailing_hyphens() -> None:
    assert slugify("  -Acme-  ") == "acme"


def test_build_project_iri_from_tenant_and_slugified_name() -> None:
    assert build_project_iri("tenant-a", "acme-corp") == "urn:weave:project:tenant-a:acme-corp"

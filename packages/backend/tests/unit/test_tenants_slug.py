"""G15: `slugify_tenant_id` is the pure part of `tenancy/tenants.py` --
everything else needs real Postgres (see `tests/integration/
test_operator_companies.py`)."""

from __future__ import annotations

from weave_backend.tenancy.tenants import slugify_tenant_id


def test_slugify_lowercases_and_hyphenates() -> None:
    assert slugify_tenant_id("Acme Corp") == "acme-corp"


def test_slugify_strips_punctuation() -> None:
    assert slugify_tenant_id("Acme, Inc.!") == "acme-inc"


def test_slugify_collapses_repeated_separators() -> None:
    assert slugify_tenant_id("  Acme   & Co  ") == "acme-co"


def test_slugify_falls_back_to_tenant_for_an_empty_result() -> None:
    assert slugify_tenant_id("!!!") == "tenant"

"""TASK-004 unit tests: deterministic, tenant-scoped IRI generation for a
(kind, label) pair (AC-004-04). Implementation hint: normalise the label
(lowercase, strip punctuation, spaces -> hyphens), prefix with
``{tenant_iri}/{kind}/``, encode.
"""

from __future__ import annotations

from weave_backend.authoring.iri import build_class_iri, slugify

_TENANT_IRI = "https://weave.io/tenants/acme"


def test_slugify_lowercases_and_hyphenates_spaces() -> None:
    assert slugify("Customer Onboarding") == "customer-onboarding"


def test_slugify_strips_punctuation() -> None:
    assert slugify("Customer Onboarding!!") == "customer-onboarding"
    assert slugify("Order (Processing)") == "order-processing"


def test_slugify_collapses_repeated_whitespace() -> None:
    assert slugify("Customer   Onboarding") == "customer-onboarding"


def test_build_class_iri_is_deterministic_for_the_same_kind_and_label() -> None:
    first = build_class_iri(_TENANT_IRI, "Process", "Customer Onboarding")
    second = build_class_iri(_TENANT_IRI, "Process", "Customer Onboarding")
    assert first == second


def test_build_class_iri_is_idempotent_across_label_casing_and_punctuation() -> None:
    """Same underlying concept, different literal casing/punctuation ->
    same IRI (this is what makes import/NL re-runs idempotent).
    """
    first = build_class_iri(_TENANT_IRI, "Process", "Customer Onboarding")
    second = build_class_iri(_TENANT_IRI, "Process", "customer onboarding!!")
    assert first == second


def test_build_class_iri_is_scoped_by_kind() -> None:
    process_iri = build_class_iri(_TENANT_IRI, "Process", "Onboarding")
    activity_iri = build_class_iri(_TENANT_IRI, "Activity", "Onboarding")
    assert process_iri != activity_iri


def test_build_class_iri_is_prefixed_by_the_tenant_iri_and_kind() -> None:
    iri = build_class_iri(_TENANT_IRI, "Process", "Customer Onboarding")
    assert iri == f"{_TENANT_IRI}/Process/customer-onboarding"

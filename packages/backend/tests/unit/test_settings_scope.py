"""PR #11 finding 4: `tenant_of` extracts the tenant segment from a scope
IRI so callers can check it against `principal.tenant_id` before writing.
"""

from __future__ import annotations

import pytest

from weave_backend.settings.scope import InvalidScopeIri, tenant_of, workspace_of


def test_tenant_of_company_scope() -> None:
    assert tenant_of("urn:weave:tenant:acme:company") == "acme"


def test_tenant_of_workspace_scope() -> None:
    assert tenant_of("urn:weave:tenant:acme:ws:w1") == "acme"


def test_tenant_of_project_scope() -> None:
    assert tenant_of("urn:weave:tenant:acme:ws:w1:project:p1") == "acme"


def test_tenant_of_rejects_malformed_iri() -> None:
    with pytest.raises(InvalidScopeIri):
        tenant_of("not-a-scope-iri")


def test_workspace_of_workspace_scope_returns_the_workspace_id() -> None:
    assert workspace_of("urn:weave:tenant:acme:ws:w1") == "w1"


def test_workspace_of_project_scope_returns_the_owning_workspace_id() -> None:
    assert workspace_of("urn:weave:tenant:acme:ws:w1:project:p1") == "w1"


def test_workspace_of_company_scope_returns_none() -> None:
    """QA FAIL remediation (AC-3): company/domain scope has no workspace
    segment at all -- there's no membership row to check, so these scopes
    stay tenant-match-only (existing precedent in test_tenancy_isolation's
    company-scope settings tests, which use a plain authenticated user
    with zero workspace_members rows anywhere)."""
    assert workspace_of("urn:weave:tenant:acme:company") is None


def test_workspace_of_domain_scope_returns_none() -> None:
    assert workspace_of("urn:weave:tenant:acme:domain:d1") is None

"""PR #11 finding 4: `tenant_of` extracts the tenant segment from a scope
IRI so callers can check it against `principal.tenant_id` before writing.
"""

from __future__ import annotations

import pytest

from weave_backend.settings.scope import InvalidScopeIri, tenant_of


def test_tenant_of_company_scope() -> None:
    assert tenant_of("urn:weave:tenant:acme:company") == "acme"


def test_tenant_of_workspace_scope() -> None:
    assert tenant_of("urn:weave:tenant:acme:ws:w1") == "acme"


def test_tenant_of_project_scope() -> None:
    assert tenant_of("urn:weave:tenant:acme:ws:w1:project:p1") == "acme"


def test_tenant_of_rejects_malformed_iri() -> None:
    with pytest.raises(InvalidScopeIri):
        tenant_of("not-a-scope-iri")

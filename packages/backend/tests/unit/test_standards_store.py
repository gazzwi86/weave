"""TASK-001 (build-engine EPIC-002) unit test: AC-7's scope/project_id
consistency check -- pure validation, no DB.
"""

from __future__ import annotations

import pytest

from weave_backend.standards.store import ScopeProjectMismatch, validate_scope_project


def test_validate_scope_project_rejects_project_scope_without_project_id() -> None:
    with pytest.raises(ScopeProjectMismatch):
        validate_scope_project("project", None)


def test_validate_scope_project_rejects_company_scope_with_project_id() -> None:
    with pytest.raises(ScopeProjectMismatch):
        validate_scope_project("company", "urn:weave:project:t1:acme")


def test_validate_scope_project_accepts_matching_pairs() -> None:
    validate_scope_project("project", "urn:weave:project:t1:acme")
    validate_scope_project("company", None)

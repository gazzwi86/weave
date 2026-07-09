"""PLAT-TASK-004 AC-3: `ROLE_RANK` is the single authoritative role
hierarchy; `check_role` is the pure decision function both the workspace and
tenant-admin dependencies call through -- a true unit test needs no real
Postgres, only a fake `workspace_members` row (`_FakeConnection`, matching
the rest of this suite's precedent).
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.auth.dependencies import Principal, RoleGrant
from weave_backend.rbac import (
    ROLE_RANK,
    InsufficientProjectRole,
    InsufficientRole,
    ProjectAction,
    check_role,
    enforce_project_role,
    enforce_workspace_role,
    has_admin_grant,
    is_tenant_admin,
    resolve_workspace_role,
)

_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111"


class _FakeConnection:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        return self._row


def test_role_rank_order_is_authoritative() -> None:
    assert ROLE_RANK == {"read": 0, "author": 1, "publish": 2, "admin": 3}


def test_check_role_allows_equal_or_higher_role() -> None:
    check_role("admin", "admin")
    check_role("publish", "author")  # higher rank satisfies a lower requirement


def test_rbac_insufficient_role_returns_403() -> None:
    with pytest.raises(InsufficientRole) as exc_info:
        check_role("author", "admin")

    assert exc_info.value.status_code == 403
    # Starlette types HTTPException.detail as `str | None`; InsufficientRole
    # deliberately passes a dict (the exact 403 body AC-3 specifies).
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "forbidden",
        "required_role": "admin",
    }


def test_check_role_rejects_missing_or_unrecognised_role() -> None:
    with pytest.raises(InsufficientRole):
        check_role(None, "read")
    with pytest.raises(InsufficientRole):
        check_role("not-a-real-role", "read")


async def test_resolve_workspace_role_returns_none_when_no_active_membership() -> None:
    conn = _FakeConnection(row=None)

    role = await resolve_workspace_role(
        conn, tenant_id="acme", workspace_id=_WORKSPACE_ID, user_sub="u-nobody"
    )

    assert role is None


async def test_resolve_workspace_role_returns_the_active_row_role() -> None:
    conn = _FakeConnection(row={"role": "author"})

    role = await resolve_workspace_role(
        conn, tenant_id="acme", workspace_id=_WORKSPACE_ID, user_sub="u-author"
    )

    assert role == "author"


async def test_is_tenant_admin_true_only_with_an_admin_membership_row() -> None:
    admin_conn = _FakeConnection(row={"1": 1})
    non_admin_conn = _FakeConnection(row=None)

    assert await is_tenant_admin(admin_conn, tenant_id="acme", user_sub="u-admin") is True
    assert await is_tenant_admin(non_admin_conn, tenant_id="acme", user_sub="u-viewer") is False


async def test_enforce_workspace_role_rejects_a_non_member() -> None:
    """QA FAIL (AC-3): settings/sparql routes derive workspace_id from a
    scope IRI, not a path param, so they can't use the
    `require_workspace_role` dependency factory directly -- this is the
    shared check both that factory and those routes call through.
    """
    conn = _FakeConnection(row=None)

    with pytest.raises(InsufficientRole):
        await enforce_workspace_role(
            conn,
            tenant_id="acme",
            workspace_id=_WORKSPACE_ID,
            user_sub="u-outsider",
            min_role="read",
        )


async def test_enforce_workspace_role_allows_a_sufficient_role() -> None:
    conn = _FakeConnection(row={"role": "author"})

    await enforce_workspace_role(
        conn, tenant_id="acme", workspace_id=_WORKSPACE_ID, user_sub="u-author", min_role="read"
    )


# --- TASK-011: project-level role guard -------------------------------


def _principal(*, roles: list[RoleGrant] | None = None) -> Principal:
    return Principal(
        sub="u1",
        tenant_id="acme",
        principal_iri="urn:weave:person:acme:u1",
        roles=roles or [],
    )


class _RaisingAuditEmitter:
    """Stands in for `AuditEmitter` -- always raises, proving the guard's
    403 does not depend on the audit write succeeding (AC-6).
    """

    async def emit(self, conn: Any, event: Any) -> None:
        raise RuntimeError("audit sink unavailable")


def test_has_admin_grant_true_for_a_tenant_scoped_grant() -> None:
    roles = [RoleGrant(scope="tenant", role="admin")]

    assert has_admin_grant(roles, domain="urn:weave:domain:acme:sales") is True
    assert has_admin_grant(roles, domain=None) is True


def test_has_admin_grant_true_for_a_matching_domain_grant() -> None:
    roles = [RoleGrant(scope="domain", role="owner", domain_iri="urn:weave:domain:acme:sales")]

    assert has_admin_grant(roles, domain="urn:weave:domain:acme:sales") is True


def test_has_admin_grant_false_for_a_different_domain_grant() -> None:
    roles = [RoleGrant(scope="domain", role="admin", domain_iri="urn:weave:domain:acme:sales")]

    assert has_admin_grant(roles, domain="urn:weave:domain:acme:marketing") is False
    assert has_admin_grant(roles, domain=None) is False


def test_has_admin_grant_false_for_a_non_admin_role() -> None:
    roles = [RoleGrant(scope="tenant", role="member")]

    assert has_admin_grant(roles, domain=None) is False


async def test_enforce_project_role_allows_settings_mutation_to_project_admin() -> None:
    conn = _FakeConnection(row={"role": "admin"})

    await enforce_project_role(
        conn, _principal(), project_iri="urn:weave:project:acme:p1", action=ProjectAction.SETTINGS
    )


async def test_enforce_project_role_allows_backlog_authoring_to_editor() -> None:
    conn = _FakeConnection(row={"role": "editor"})

    await enforce_project_role(
        conn, _principal(), project_iri="urn:weave:project:acme:p1", action=ProjectAction.BACKLOG
    )


async def test_enforce_project_role_denies_contributors_mutation_to_editor() -> None:
    conn = _FakeConnection(row={"role": "editor"})

    with pytest.raises(InsufficientProjectRole) as exc_info:
        await enforce_project_role(
            conn,
            _principal(),
            project_iri="urn:weave:project:acme:p1",
            action=ProjectAction.CONTRIBUTORS,
        )

    assert exc_info.value.status_code == 403


async def test_enforce_project_role_allows_any_action_to_a_tenant_admin_grant() -> None:
    """AC-4: tenant admin/owner overlays the per-project role entirely --
    no `project_contributors` row needed."""
    conn = _FakeConnection(row=None)
    principal = _principal(roles=[RoleGrant(scope="tenant", role="admin")])

    await enforce_project_role(
        conn, principal, project_iri="urn:weave:project:acme:p1", action=ProjectAction.CONTRIBUTORS
    )


async def test_enforce_project_role_returns_403_even_when_audit_emit_fails() -> None:
    """AC-6: the denial audit emit is best-effort -- a broken audit sink
    must not turn a 403 into a 500."""
    conn = _FakeConnection(row={"role": "editor"})

    with pytest.raises(InsufficientProjectRole):
        await enforce_project_role(
            conn,
            _principal(),
            project_iri="urn:weave:project:acme:p1",
            action=ProjectAction.CONTRIBUTORS,
            audit_emitter=_RaisingAuditEmitter(),
        )

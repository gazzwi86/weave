"""G15: `require_super_admin` is the sole guard on the operator-console
cross-tenant endpoints (`routers/operator.py`) -- there is no RLS backstop
on the `tenants` registry table (ADR-023), so these unit tests are the
mandatory proof (per the task brief) that a non-super-admin, and
specifically a tenant-admin of one company, cannot pass this gate. Pure-JWT
(no DB lookup), so no `_FakeConnection` needed -- matches `has_admin_grant`'s
own unit-test style in `test_rbac.py`.
"""

from __future__ import annotations

import pytest

from weave_backend.auth.dependencies import Principal, RoleGrant
from weave_backend.rbac import InsufficientRole, has_platform_grant, require_super_admin


def _principal(*, roles: list[RoleGrant] | None = None) -> Principal:
    return Principal(
        sub="u1",
        tenant_id="acme",
        principal_iri="urn:weave:person:acme:u1",
        roles=roles or [],
    )


def test_has_platform_grant_true_for_a_platform_super_admin_grant() -> None:
    roles = [RoleGrant(scope="platform", role="super_admin")]

    assert has_platform_grant(roles) is True


def test_has_platform_grant_false_with_no_roles() -> None:
    assert has_platform_grant([]) is False


def test_has_platform_grant_false_for_a_tenant_admin_grant() -> None:
    """The isolation-critical case: a tenant-wide admin/owner grant (which
    overlays project/domain checks elsewhere via `has_admin_grant`) must
    NOT satisfy the platform gate -- tenant-admin of company A must never
    reach company B's operator endpoints.
    """
    roles = [RoleGrant(scope="tenant", role="admin"), RoleGrant(scope="tenant", role="owner")]

    assert has_platform_grant(roles) is False


def test_has_platform_grant_false_for_a_platform_scope_non_super_admin_role() -> None:
    """`scope="platform"` alone isn't enough -- the role must be exactly
    `super_admin`, so a future lesser platform role can't silently qualify.
    """
    roles = [RoleGrant(scope="platform", role="support")]

    assert has_platform_grant(roles) is False


async def test_require_super_admin_allows_a_platform_super_admin() -> None:
    principal = _principal(roles=[RoleGrant(scope="platform", role="super_admin")])

    result = await require_super_admin(principal)

    assert result is principal


async def test_require_super_admin_denies_no_grants() -> None:
    """Also covers `_parse_roles_claim`'s malformed-input degrade-to-`[]`
    path (auth/dependencies.py): a garbage `roles` claim ends up here as an
    empty list, which must deny, never 500.
    """
    principal = _principal(roles=[])

    with pytest.raises(InsufficientRole) as exc_info:
        await require_super_admin(principal)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "forbidden",
        "required_role": "super_admin",
    }


async def test_require_super_admin_denies_a_tenant_admin_of_company_a() -> None:
    """G15 isolation requirement, restated as the RBAC-level unit test:
    company A's tenant-admin cannot list/provision/suspend company B (or
    any company) via the operator console.
    """
    principal = _principal(roles=[RoleGrant(scope="tenant", role="admin")])

    with pytest.raises(InsufficientRole):
        await require_super_admin(principal)

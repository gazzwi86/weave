"""ONB-TASK-006: role -> onboarding-path resolution (AC-006-01/03/05/06).

Follows the `resolve_workspace_role` precedent (notifications router) rather
than the JWT `roles` grant claim -- `workspace_members.role` is the only
source of the 10 canonical persona slugs in this codebase.
"""

from __future__ import annotations

import sys
from collections.abc import Callable, Coroutine
from typing import Any

import pytest

from weave_backend.auth.dependencies import Principal
from weave_backend.onboarding.path_resolver import ROLE_TO_PATH, resolve_role_path

_TENANT = "acme-corp"
_SUB = "u-1"
_IRI = "urn:weave:principal:user:u-1"

_ALL_TEN_SLUGS = [
    "workspace_admin",
    "enterprise_architect",
    "engineer",
    "automation_author",
    "ops_sre",
    "data_steward",
    "compliance_officer",
    "business_analyst_sme",
    "brand_content_owner",
    "viewer",
]


def _principal() -> Principal:
    return Principal(sub=_SUB, tenant_id=_TENANT, principal_iri=_IRI)


class _StubConn:
    """Not queried directly by the resolver's asyncpg.Connection param in
    these unit tests -- role/workspace lookups are monkeypatched at the
    module level below, mirroring test_onboarding_store.py's fake-conn style
    for the parts that *are* exercised at the store layer.
    """


@pytest.mark.parametrize("role_slug", _ALL_TEN_SLUGS)
async def test_ac_006_01_every_canonical_role_maps_to_exactly_one_path(
    monkeypatch: pytest.MonkeyPatch, role_slug: str
) -> None:
    monkeypatch.setattr(
        "weave_backend.onboarding.path_resolver.get_active_workspace",
        _async_return("ws-1"),
    )
    monkeypatch.setattr(
        "weave_backend.onboarding.path_resolver.resolve_workspace_role",
        _async_return(role_slug),
    )

    resolved = await resolve_role_path(_StubConn(), _principal())

    assert resolved.role_path in {"business", "technical", "compliance", "admin"}
    assert resolved.path_variant in {"default", "read_only"}
    assert resolved.persist is True


def test_ac_006_01_mapping_table_covers_all_ten_slugs_with_no_gaps() -> None:
    assert set(ROLE_TO_PATH) == set(_ALL_TEN_SLUGS)


@pytest.mark.parametrize("no_role", [None, "viewer"])
async def test_ac_006_03_zero_or_viewer_role_resolves_business_read_only(
    monkeypatch: pytest.MonkeyPatch, no_role: str | None
) -> None:
    monkeypatch.setattr(
        "weave_backend.onboarding.path_resolver.get_active_workspace",
        _async_return(None if no_role is None else "ws-1"),
    )
    monkeypatch.setattr(
        "weave_backend.onboarding.path_resolver.resolve_workspace_role",
        _async_return(no_role),
    )

    resolved = await resolve_role_path(_StubConn(), _principal())

    assert resolved.role_path == "business"
    assert resolved.path_variant == "read_only"


def test_ac_006_05_resolver_module_imports_no_idp_sdk() -> None:
    module = sys.modules["weave_backend.onboarding.path_resolver"]
    idp_markers = ("boto3", "cognito", "okta", "auth0", "azure.identity")
    imported = set(dir(module))
    assert not any(
        marker in str(module.__dict__.get(name)) for marker in idp_markers for name in imported
    )


async def test_ac_006_06_unreachable_role_source_falls_back_without_persisting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _boom(*_args: object, **_kwargs: object) -> str | None:
        raise ConnectionError("redis unreachable")

    monkeypatch.setattr("weave_backend.onboarding.path_resolver.get_active_workspace", _boom)

    resolved = await resolve_role_path(_StubConn(), _principal())

    assert resolved.role_path == "business"
    assert resolved.path_variant == "read_only"
    assert resolved.persist is False


def _async_return(value: object) -> Callable[..., Coroutine[Any, Any, object]]:
    async def _fn(*_args: object, **_kwargs: object) -> object:
        return value

    return _fn

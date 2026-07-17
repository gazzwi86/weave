"""TASK-014 unit tests: AC-2/AC-3/AC-4 -- the create-time governance-cascade
resolution and the PATCH-time cap/model-tier validation, against a stub
asyncpg connection (mirrors `test_settings_resolver.py`'s `_FakeConnection`,
no real Postgres needed -- `resolve_setting`'s only DB call is `fetch`).

ADR-013: a Build project IRI never parses under `settings/scope.py`'s
cascade grammar, so every cascade attempt here raises `InvalidScopeIri` and
falls back to company scope -- these tests exercise that fallback, not a
literal domain/project override (which is unreachable in production today).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from weave_backend.build.costs import BUDGET_CAP_KEY
from weave_backend.projects.governance import (
    DEFAULT_MODEL_TIER,
    MODEL_TIER_KEY,
    CapLooserThanParent,
    InvalidModelTier,
    NewProjectShell,
    create_project_shell,
    resolve_governance,
    validate_cap_against_parent,
    validate_model_tier,
)
from weave_backend.projects.model import Project

_TENANT = "acme-corp"
_COMPANY_IRI = f"urn:weave:tenant:{_TENANT}:company"
_PROJECT_IRI = f"urn:weave:project:{_TENANT}:widget-factory"


class _FakeConnection:
    """Keyed by (scope_iri, key) -- same shape as
    `test_settings_resolver.py`'s fake, minus the write path (this module
    never calls `set_setting`).
    """

    def __init__(self, rows: dict[tuple[str, str], dict[str, Any]] | None = None) -> None:
        self.rows = rows or {}

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        assert "scope_iri = ANY($2)" in query
        _tenant_id, scope_iris, key = args
        return [
            {"scope_iri": iri, "scope": row["scope"], "value": row["value"]}
            for iri in scope_iris
            if (row := self.rows.get((iri, key))) is not None
        ]


def _seeded(key: str, value: Any) -> _FakeConnection:
    return _FakeConnection({(_COMPANY_IRI, key): {"scope": "company", "value": json.dumps(value)}})


async def test_resolve_governance_defaults_when_nothing_configured() -> None:
    conn = _FakeConnection()

    snapshot = await resolve_governance(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert snapshot.model_tier == DEFAULT_MODEL_TIER
    assert snapshot.model_tier_source == "default"
    assert snapshot.cap_usd is None
    assert snapshot.cap_source is None


async def test_resolve_governance_falls_back_to_company_scope() -> None:
    conn = _FakeConnection(
        {
            (_COMPANY_IRI, MODEL_TIER_KEY): {"scope": "company", "value": json.dumps("premium")},
            (_COMPANY_IRI, BUDGET_CAP_KEY): {"scope": "company", "value": json.dumps(500.0)},
        }
    )

    snapshot = await resolve_governance(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert snapshot.model_tier == "premium"
    assert snapshot.model_tier_source == "company"
    assert snapshot.cap_usd == 500.0
    assert snapshot.cap_source == "company"


async def test_validate_cap_against_parent_passes_when_no_parent_configured() -> None:
    conn = _FakeConnection()

    await validate_cap_against_parent(conn, tenant_id=_TENANT, value_usd=1000.0)


async def test_validate_cap_against_parent_passes_when_tighter_than_parent() -> None:
    conn = _seeded(BUDGET_CAP_KEY, 500.0)

    await validate_cap_against_parent(conn, tenant_id=_TENANT, value_usd=100.0)


async def test_validate_cap_against_parent_rejects_looser_than_parent() -> None:
    conn = _seeded(BUDGET_CAP_KEY, 500.0)

    with pytest.raises(CapLooserThanParent) as exc_info:
        await validate_cap_against_parent(conn, tenant_id=_TENANT, value_usd=501.0)

    assert exc_info.value.parent_cap_usd == 500.0
    assert exc_info.value.level == "company"


@pytest.mark.parametrize("tier", ["standard", "fast", "premium", "experimental"])
def test_validate_model_tier_accepts_defined_tiers(tier: str) -> None:
    validate_model_tier(tier)


def test_validate_model_tier_rejects_unknown_tier() -> None:
    with pytest.raises(InvalidModelTier):
        validate_model_tier("bespoke")


async def test_create_project_shell_emits_project_created_audit_event() -> None:
    """Bug 5: `create_project_shell` is the one shared path both project-
    create callers go through (direct create + request-approval auto-
    create) -- mirrors `routers/tenancy.py`'s `workspace.created` emit so a
    project's creation shows up in the audit trail same as a workspace's.
    """
    conn = _FakeConnection()
    created_project = Project(
        project_iri=_PROJECT_IRI,
        name="Widget Factory",
        pinned_graph_version_iri="urn:weave:version:v1",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    emit_mock = AsyncMock(return_value=None)
    with (
        patch(
            "weave_backend.projects.governance.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v1"),
        ),
        patch(
            "weave_backend.projects.governance.create_project",
            AsyncMock(return_value=created_project),
        ),
        patch("weave_backend.projects.governance.default_audit_emitter.emit", emit_mock),
    ):
        # ce_client is unused -- get_pinned_latest_version is mocked above.
        project, _governance = await create_project_shell(
            conn,
            ce_client=httpx.AsyncClient(base_url="http://ce"),
            fields=NewProjectShell(tenant_id=_TENANT, slug="widget-factory", name="Widget Factory"),
            actor_iri="urn:weave:principal:user:u-1",
        )

    assert project.project_iri == _PROJECT_IRI
    emit_mock.assert_awaited_once()
    assert emit_mock.await_args is not None
    audit_event = emit_mock.await_args.args[1]
    assert audit_event.tenant_id == _TENANT
    assert audit_event.event_type == "project.created"
    assert audit_event.actor_iri == "urn:weave:principal:user:u-1"
    assert audit_event.subject_iri == _PROJECT_IRI
    assert audit_event.payload == {"slug": "widget-factory"}
    assert audit_event.engine == "build"

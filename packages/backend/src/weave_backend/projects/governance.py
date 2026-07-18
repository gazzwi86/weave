"""TASK-014 (ADR-009 Decision #1, FR-007/FR-008/FR-009/FR-066): the one
shared create-shell function both project-create callers (request-approval
auto-create and direct create) go through, plus the governance-cascade
resolution and PATCH-time validation it shares with `routers/project_settings.py`.

ADR-013: a Build project IRI (`urn:weave:project:{tid}:{slug}`) never parses
under `settings/scope.py`'s cascade grammar, and `projects` has no domain
column -- so "resolve the Company->Domain->Project cascade" can only reach
company scope in production today. Every resolution here follows the exact
`InvalidScopeIri`-catch-and-retry-at-company pattern `build/costs.py::
resolve_budget_cap` established; domain/project overrides are inert until
that migration lands (same root cause as ADR-012).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import asyncpg
import httpx

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.build.costs import BUDGET_CAP_KEY
from weave_backend.projects.ce_version_client import get_pinned_latest_version
from weave_backend.projects.model import NewProject, Project, build_project_iri, create_project
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri, company_iri

#: FR-009: fixed v1 enum -- no custom tiers; domain policy supplies only the
#: default.
MODEL_TIERS = frozenset({"standard", "fast", "premium", "experimental"})
MODEL_TIER_KEY = "build.model_tier"
DEFAULT_MODEL_TIER = "standard"


class InvalidModelTier(Exception):
    def __init__(self, tier: str) -> None:
        self.tier = tier
        super().__init__(f"not a defined model tier: {tier}")


class CapLooserThanParent(Exception):
    """AC-3: reject with the binding parent level named."""

    def __init__(self, parent_cap_usd: float, *, level: str) -> None:
        self.parent_cap_usd = parent_cap_usd
        self.level = level
        super().__init__(f"cap looser than {level} cap: {parent_cap_usd}")


@dataclass(frozen=True)
class GovernanceSnapshot:
    model_tier: str
    model_tier_source: str  # "company" | "default"
    cap_usd: float | None
    cap_source: str | None  # "company" | None


@dataclass(frozen=True)
class NewProjectShell:
    """Grouped input for `create_project_shell` -- everything `NewProject`
    needs except `pinned_graph_version_iri`, which this function resolves
    itself (Law E: keeps the function's own params <= 5).
    """

    tenant_id: str
    slug: str
    name: str
    description: str | None = None
    source_control_provider: str | None = None
    source_control_token_secret_ref: str | None = None
    #: TASK-024 AC-5: passed straight through to `NewProject` -- see its
    #: own docstring.
    repo_name_hint: str | None = None


async def _resolve_at_company(
    conn: asyncpg.Connection, *, tenant_id: str, key: str
) -> tuple[Any, str] | None:
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=key, context_iri=company_iri(tenant_id)
        )
    except SettingNotFound:
        return None
    return resolved.value, resolved.resolved_at


async def _resolve_cascaded(
    conn: asyncpg.Connection, *, tenant_id: str, key: str, project_iri: str
) -> tuple[Any, str] | None:
    """Company->Domain->Project cascade, company-reachable only (ADR-013)."""
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=key, context_iri=project_iri
        )
        return resolved.value, resolved.resolved_at
    except InvalidScopeIri:
        return await _resolve_at_company(conn, tenant_id=tenant_id, key=key)
    except SettingNotFound:
        return None


async def resolve_governance(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> GovernanceSnapshot:
    """AC-2/AC-4: never raises -- absent config resolves to the safe default
    (fail-open cap per ADR-009, `standard` tier default).
    """
    tier_hit = await _resolve_cascaded(
        conn, tenant_id=tenant_id, key=MODEL_TIER_KEY, project_iri=project_iri
    )
    cap_hit = await _resolve_cascaded(
        conn, tenant_id=tenant_id, key=BUDGET_CAP_KEY, project_iri=project_iri
    )
    return GovernanceSnapshot(
        model_tier=str(tier_hit[0]) if tier_hit else DEFAULT_MODEL_TIER,
        model_tier_source=tier_hit[1] if tier_hit else "default",
        cap_usd=float(cap_hit[0]) if cap_hit else None,
        cap_source=cap_hit[1] if cap_hit else None,
    )


def validate_model_tier(tier: str) -> None:
    """AC-4: accept only defined tiers."""
    if tier not in MODEL_TIERS:
        raise InvalidModelTier(tier)


async def validate_cap_against_parent(
    conn: asyncpg.Connection, *, tenant_id: str, value_usd: float
) -> None:
    """AC-3: tighter-wins -- company is the only reachable parent level for
    a Build project today (ADR-013). No-op when no parent cap is configured.
    """
    hit = await _resolve_at_company(conn, tenant_id=tenant_id, key=BUDGET_CAP_KEY)
    if hit is not None and value_usd > float(hit[0]):
        raise CapLooserThanParent(float(hit[0]), level="company")


async def create_project_shell(
    conn: asyncpg.Connection,
    *,
    ce_client: httpx.AsyncClient,
    fields: NewProjectShell,
    actor_iri: str,
    headers: dict[str, str] | None = None,
) -> tuple[Project, GovernanceSnapshot]:
    """ADR-009 Decision #1: THE shared create path. Both callers (direct
    create FR-066, request-approval auto-create FR-007) call this and only
    this -- CE-pin + governance-cascade resolution can't drift between the
    two paths because there's exactly one place both happen, atomically with
    the insert. Raises `CeVersionUnavailable` / `ProjectExists` same as the
    functions it wraps -- callers keep their own pre-check and error
    handling unchanged.

    Emits a `project.created` audit event on success, mirroring
    `routers/tenancy.py`'s `workspace.created` emit -- both callers route
    through here so the event can't be missed on either path.
    """
    pinned_version = await get_pinned_latest_version(ce_client, headers=headers)
    project_iri = build_project_iri(fields.tenant_id, fields.slug)
    governance = await resolve_governance(
        conn, tenant_id=fields.tenant_id, project_iri=project_iri
    )
    project = await create_project(
        conn,
        NewProject(
            tenant_id=fields.tenant_id,
            slug=fields.slug,
            name=fields.name,
            description=fields.description,
            pinned_graph_version_iri=pinned_version,
            source_control_provider=fields.source_control_provider,
            source_control_token_secret_ref=fields.source_control_token_secret_ref,
            repo_name_hint=fields.repo_name_hint,
        ),
    )
    await default_audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=fields.tenant_id,
            event_type="project.created",
            actor_iri=actor_iri,
            subject_iri=project.project_iri,
            payload={"slug": fields.slug},
            engine="build",
        ),
    )
    return project, governance

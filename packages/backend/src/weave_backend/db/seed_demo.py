"""Idempotent local-dev seed: one demo workspace with two logins and a small
BPMO graph, so a fresh `make dev` stack is actually clickable end to end.

Run via ``uv run python -m weave_backend.db.seed_demo`` (after migrations).
Safe to re-run: workspace lookup is by (tenant_id, slug); principals/members
upsert; the graph is only (re)minted the first time the workspace is
created, so re-running never piles up duplicate graph versions.

Login: mock-oidc derives `sub` from `email.split("@")[0]` and takes
`tenant_id` from the login form (see `mock_oidc/app.py`), so these seeded
users log in by typing their email + tenant on the mock sign-in page --
no password.
"""

from __future__ import annotations

import asyncio
import contextlib
from dataclasses import dataclass
from typing import Any

import asyncpg
from rdflib import Graph

from weave_backend.audit.emitter import AuditEvent, HashChainAuditEmitter
from weave_backend.authoring.shapes import parse_raw_shape, shape_subject_iri
from weave_backend.briefs.store import (
    NewBrief,
    build_brief_iri,
    generate_task_id,
    insert_task_brief,
)
from weave_backend.build.state_spine import StateSpine, TaskState, commit_state_spine
from weave_backend.db.pool import close_app_pool, tenant_connection
from weave_backend.db.seed_demo_data import (
    BUILD_PROJECT_NAME,
    EPIC_TASKS,
    SHAPE_TTL_TEMPLATE,
    STANDARDS_DOCS,
    TENANT_SHAPES,
)
from weave_backend.db.seed_demo_graph import DEMO_OPS
from weave_backend.identity.registry import ensure_human_principal, human_principal_iri
from weave_backend.operations.governance_shapes import ShapeCommit, commit_tenant_shape
from weave_backend.operations.graph_ops import apply_operations
from weave_backend.operations.outbox import flush_pending
from weave_backend.operations.versioning import mint_version, publish_version
from weave_backend.projects.model import NewProject, create_project, slugify
from weave_backend.rdf.oxigraph_client import load_graph
from weave_backend.standards.store import NewStandard, upsert_standard
from weave_backend.tenancy.members import MemberAlreadyActive, activate_member, invite_member
from weave_backend.tenancy.sessions import get_redis, set_active_workspace
from weave_backend.tenancy.workspaces import Workspace, create_workspace

TENANT_ID = "acme-corp"  # matches mock_oidc's _DEFAULT_TENANT_ID
WORKSPACE_SLUG = "demo"
WORKSPACE_NAME = "Demo Workspace"

# (email, sub, display_name, workspace role) -- sub is derived by mock-oidc
# as email.split("@")[0], reproduced here so we invite/activate the exact
# same identity a real login will present.
#
# SE2: keep the legacy "admin"/"author" roles -- they are NOT a bug. "admin"
# is the platform super-admin sentinel the operator/provisioning surfaces gate
# on literally: `settings/workspaces/page.tsx` (`role !== "admin"`) and the
# backend `require_tenant_admin` on `GET /tenants/{id}/workspaces`. Renaming it
# to a canonical in-tenant slug (workspace_admin) locks the demo admin out of
# that surface. The Members-panel "shows as Viewer" symptom was fixed at its
# true source in #181: `roles.ts::roleLabel` now maps the legacy "admin"/
# "author" via LEGACY_ROLE_LABELS, which "coexist permanently" with the 10
# canonical slugs -- so no seed change is needed for the display.
ADMIN = ("admin@weave.local", "admin", "Demo Super Admin", "admin")
CLIENT = ("client@weave.local", "client", "Demo Client User", "author")


async def _ensure_workspace(conn: asyncpg.Connection) -> tuple[Workspace, bool]:
    """Returns (workspace, created) -- created is False on a re-run."""
    row = await conn.fetchrow(
        "SELECT id, slug, display_name, named_graph_iri, created_at FROM workspaces "
        "WHERE tenant_id = $1 AND slug = $2",
        TENANT_ID,
        WORKSPACE_SLUG,
    )
    if row is not None:
        return Workspace(
            id=str(row["id"]),
            slug=row["slug"],
            display_name=row["display_name"],
            named_graph_iri=row["named_graph_iri"],
            created_at=row["created_at"],
        ), False
    workspace = await create_workspace(
        conn, tenant_id=TENANT_ID, slug=WORKSPACE_SLUG, display_name=WORKSPACE_NAME
    )
    return workspace, True


async def _ensure_member(
    conn: asyncpg.Connection, workspace_id: str, email: str, sub: str, role: str
) -> None:
    with contextlib.suppress(MemberAlreadyActive):
        await invite_member(
            conn, tenant_id=TENANT_ID, workspace_id=workspace_id, email=email, role=role
        )
    await activate_member(conn, workspace_id=workspace_id, email=email, user_sub=sub)


@dataclass(frozen=True)
class _SeededGraph:
    """Bundles `_seed_graph`'s results (Law E's 5-parameter budget) -- the
    later steps need `ref_map` (to cross-link `standards_documents.policy_iri`
    to the `BrandStandard` individuals actually minted) and `version_iri`
    (to pin the Build project) alongside the existing `semver`.
    """

    semver: str
    version_iri: str
    ref_map: dict[str, str]


async def _seed_graph(conn: asyncpg.Connection, workspace: Workspace) -> _SeededGraph:
    graph = Graph()
    result = apply_operations(graph, DEMO_OPS)
    turtle = graph.serialize(format="turtle")

    actor_iri = human_principal_iri(ADMIN[1])
    version_iri, semver = await mint_version(
        conn,
        tenant_id=TENANT_ID,
        workspace_id=workspace.id,
        named_graph_iri=workspace.named_graph_iri,
        actor_iri=actor_iri,
    )
    await publish_version(
        conn, tenant_id=TENANT_ID, workspace_id=workspace.id, version_iri=version_iri
    )

    # ponytail: POST /api/sparql resolves the raw unversioned
    # workspace.named_graph_iri while GET /api/sparql and most reads resolve
    # through the version-pinned graph -- a pre-existing split (see
    # routers/sparql.py). Load into both so the demo works via either path.
    # Ceiling: two copies of the same Turtle; upgrade path is fixing that
    # inconsistency at the router level.
    await load_graph(version_iri, turtle)
    await load_graph(workspace.named_graph_iri, turtle)
    return _SeededGraph(semver=semver, version_iri=version_iri, ref_map=result.ref_map)


async def _seed_shapes(conn: asyncpg.Connection, redis_client: Any) -> None:
    """Deliverable 3: commits `TENANT_SHAPES` via the sole writer to a
    tenant's governance shapes graph (`governance_shapes.commit_tenant_shape`)
    -- never a raw graph load, so the same PROV-O stamping, audit-outbox
    enqueue, and shapes-version bump a real compliance-officer commit gets
    also applies to the seeded demo shapes.
    """
    approver_iri = human_principal_iri(ADMIN[1])
    for iri, target, message in TENANT_SHAPES:
        turtle = SHAPE_TTL_TEMPLATE.format(iri=iri, target=target, message=message)
        shape_graph = parse_raw_shape(turtle)
        shape_iri = shape_subject_iri(shape_graph)
        await commit_tenant_shape(
            conn,
            redis_client,
            ShapeCommit(
                tenant_id=TENANT_ID,
                approver_iri=approver_iri,
                shape_graph=shape_graph,
                shape_iri=shape_iri,
                ai_generated=False,
            ),
        )


async def _seed_standards(conn: asyncpg.Connection, ref_map: dict[str, str]) -> None:
    approver_iri = human_principal_iri(ADMIN[1])
    for key, title, body_md, policy_ref in STANDARDS_DOCS:
        await upsert_standard(
            conn,
            NewStandard(
                tenant_id=TENANT_ID,
                scope="company",
                project_id=None,
                standard_key=key,
                title=title,
                body_md=body_md,
                stack_pins=None,
                policy_iri=ref_map[policy_ref],
                status="active",
                created_by=approver_iri,
            ),
        )


async def _seed_build_project(conn: asyncpg.Connection, version_iri: str) -> None:
    slug = slugify(BUILD_PROJECT_NAME)
    project = await create_project(
        conn,
        NewProject(
            tenant_id=TENANT_ID,
            slug=slug,
            name=BUILD_PROJECT_NAME,
            description="Store operations platform: fulfilment, trade pricing, "
            "and online ordering.",
            pinned_graph_version_iri=version_iri,
        ),
    )

    tasks = []
    for epic_id, epic_title, title, status in EPIC_TASKS:
        task_id = generate_task_id(project.project_iri, title)
        await insert_task_brief(
            conn,
            NewBrief(
                tenant_id=TENANT_ID,
                task_id=task_id,
                project_iri=project.project_iri,
                brief_iri=build_brief_iri(task_id),
                schema_version="1.0",
                content={"epic_id": epic_id, "epic_title": epic_title, "title": title},
            ),
        )
        tasks.append(TaskState(id=task_id, status=status))

    await commit_state_spine(
        conn,
        StateSpine(
            project_iri=project.project_iri,
            tenant_id=TENANT_ID,
            run_id="demo-seed",
            phase="halted_hitl",
            turn_cap=50,
            tasks=tasks,
        ),
    )


async def seed() -> dict[str, object]:
    async with tenant_connection(TENANT_ID) as conn:
        workspace, created = await _ensure_workspace(conn)

        for email, sub, display_name, role in (ADMIN, CLIENT):
            await ensure_human_principal(
                conn, tenant_id=TENANT_ID, sub=sub, display_name=display_name
            )
            await _ensure_member(conn, workspace.id, email, sub, role)

        semver = None
        if created:
            seeded = await _seed_graph(conn, workspace)
            semver = seeded.semver
            await HashChainAuditEmitter().emit(
                conn,
                AuditEvent(
                    tenant_id=TENANT_ID,
                    event_type="seed.demo_workspace_created",
                    actor_iri=human_principal_iri(ADMIN[1]),
                    subject_iri=workspace.named_graph_iri,
                    payload={"workspace_slug": WORKSPACE_SLUG},
                ),
            )

            redis_client: Any = get_redis()
            await _seed_shapes(conn, redis_client)
            await _seed_standards(conn, seeded.ref_map)
            await _seed_build_project(conn, seeded.version_iri)

    if created:
        # A1 investigation: `_seed_shapes`' `commit_tenant_shape` enqueues its
        # `governance.shape_committed` audit events into the durable outbox
        # rather than emitting inline. Nothing else here ever delivered
        # them, so without this call those rows stayed `delivered_at IS
        # NULL` forever -- present in `audit_outbox`, absent from
        # `audit_entries`, invisible to the Audit tab. Flushing from a fresh
        # connection acquired AFTER the seeding transaction commits mirrors
        # the timing `routers/{instances,authoring,operations}.py` already
        # use. Durability/realism choice, not a chain-validity fix: flushing
        # in-transaction on the same `conn` also verifies valid.
        async with tenant_connection(TENANT_ID) as flush_conn:
            await flush_pending(flush_conn, TENANT_ID)

    # Active-workspace pointer lives in Redis, not Postgres -- set outside
    # the tenant_connection transaction. Without this, a fresh login 400s
    # with `no_active_workspace` on every workspace-scoped route (there is
    # no picker UI and no auto-select fallback).
    for _email, sub, _display_name, _role in (ADMIN, CLIENT):
        await set_active_workspace(TENANT_ID, sub, workspace.id)

    return {"workspace_id": workspace.id, "created": created, "semver": semver}


async def _main() -> dict[str, object]:
    try:
        return await seed()
    finally:
        await close_app_pool()


def main() -> None:
    result = asyncio.run(_main())
    print(f"seeded demo workspace: {result}")


if __name__ == "__main__":
    main()

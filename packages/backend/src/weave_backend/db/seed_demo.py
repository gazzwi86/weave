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

import asyncpg
from rdflib import Graph

from weave_backend.audit.emitter import AuditEvent, HashChainAuditEmitter
from weave_backend.db.pool import close_app_pool, tenant_connection
from weave_backend.identity.registry import ensure_human_principal, human_principal_iri
from weave_backend.operations.graph_ops import apply_operations
from weave_backend.operations.versioning import mint_version, publish_version
from weave_backend.rdf.oxigraph_client import load_graph
from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp, Op
from weave_backend.tenancy.members import MemberAlreadyActive, activate_member, invite_member
from weave_backend.tenancy.sessions import set_active_workspace
from weave_backend.tenancy.workspaces import Workspace, create_workspace

TENANT_ID = "acme-corp"  # matches mock_oidc's _DEFAULT_TENANT_ID
WORKSPACE_SLUG = "demo"
WORKSPACE_NAME = "Demo Workspace"

# (email, sub, display_name, workspace role) -- sub is derived by mock-oidc
# as email.split("@")[0], reproduced here so we invite/activate the exact
# same identity a real login will present.
ADMIN = ("admin@weave.local", "admin", "Demo Super Admin", "admin")
CLIENT = ("client@weave.local", "client", "Demo Client User", "author")

# Demo BPMO graph: only kinds/predicates confirmed live in
# `ontology/shapes/framework.shacl.ttl` (weave:label on every kind,
# weave:performedBy Process->Actor, weave:servesGoal
# BusinessCapability->Goal, weave:description on Activity) -- never an
# invented predicate (ontology-standards.md).
DEMO_OPS: list[Op] = [
    AddNodeOp(op="add_node", ref="actor", kind="Actor", label="Order Desk Team"),
    AddNodeOp(
        op="add_node", ref="process", kind="Process", label="Order Fulfillment"
    ),
    AddNodeOp(
        op="add_node",
        ref="activity",
        kind="Activity",
        label="Pick Items from Warehouse",
        properties={"description": "Pick ordered items from warehouse shelves."},
    ),
    AddNodeOp(op="add_node", ref="goal", kind="Goal", label="Reduce order cycle time"),
    AddNodeOp(
        op="add_node",
        ref="capability",
        kind="BusinessCapability",
        label="Fulfilment Operations",
    ),
    AddNodeOp(op="add_node", ref="system", kind="System", label="Warehouse Management System"),
    AddNodeOp(op="add_node", ref="data", kind="DataAsset", label="Customer Order"),
    AddEdgeOp(op="add_edge", subject_ref="process", predicate="performedBy", object_ref="actor"),
    AddEdgeOp(
        op="add_edge", subject_ref="capability", predicate="servesGoal", object_ref="goal"
    ),
]


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


async def _seed_graph(conn: asyncpg.Connection, workspace: Workspace) -> str:
    graph = Graph()
    apply_operations(graph, DEMO_OPS)
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
    return semver


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
            semver = await _seed_graph(conn, workspace)
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

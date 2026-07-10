"""CE-V1-TASK-012 docker-integration tests: the ingest spine against a real
Postgres + Oxigraph + LocalStack S3 stack (AC-001-01/-05/-06/-07/-09).

No real extractor ships this task (`DEFAULT_REGISTRY` is empty -- see
`ingest/extractors.py`), so a real upload's worker run always yields zero
proposals. The accept/reject scenarios below seed a job + proposal directly
via `ingest.store` (same "insert state, then hit the HTTP endpoint" pattern
`test_operations_apply.py` uses for idempotency-lock/outbox scenarios) --
this is the only way to exercise accept/reject until TASK-013+ ships a real
extractor.

`no-second-mutation-path-ingest` (AC-001-08) is a pure import-graph scan --
it's a unit test (`tests/unit/test_ingest_no_second_mutation_path.py`), not
a docker scenario; nothing about it needs a live stack.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.ingest.store import (
    JobStatusUpdate,
    NewJob,
    NewProposal,
    get_proposal,
    insert_job,
    insert_proposal,
)
from weave_backend.ingest.store import (
    update_job_status as store_update_job_status,
)
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.operations.ingest_provenance import (
    mint_activity_iri,
    mint_artefact_iri,
    start_ingest_activity,
    write_artefact_entity,
)
from weave_backend.operations.provenance import prov_graph_iri
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
from weave_backend.storage.tenant_objects import s3_client
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_CORPUS_BUCKET = "weave-corpus-test"


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _ensure_corpus_bucket() -> None:
    client_s3 = s3_client()
    existing = {b["Name"] for b in client_s3.list_buckets().get("Buckets", [])}
    if _CORPUS_BUCKET not in existing:
        client_s3.create_bucket(Bucket=_CORPUS_BUCKET)


async def _make_workspace(tenant_id: str, *, label: str) -> Workspace:
    async with tenant_connection(tenant_id) as conn:
        return await create_workspace(conn, tenant_id=tenant_id, slug=label, display_name=label)


async def _authed_headers(
    client: AsyncClient, *, tenant_id: str, workspace: Workspace, user_sub: str, role: str
) -> dict[str, str]:
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace.id,
            email=f"{user_sub}@example.invalid", role=role,
        )
        await activate_member(
            conn, workspace_id=workspace.id, email=f"{user_sub}@example.invalid", user_sub=user_sub
        )
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch = await client.post(f"/api/workspaces/{workspace.id}/switch", headers=headers)
    assert switch.status_code == 200
    return headers


async def _seed_awaiting_review_job(
    tenant_id: str, workspace: Workspace, *, ops: list[dict[str, object]]
) -> tuple[str, str]:
    """Bypasses the (extractor-less) worker: writes the artefact entity +
    starts the ingest activity for real, then inserts a job/proposal already
    at `awaiting-review` -- the state accept/reject act on.
    """
    artefact_key = f"{tenant_id}-{uuid.uuid4().hex[:8]}"
    artefact_iri = mint_artefact_iri(artefact_key)
    activity_iri = mint_activity_iri(artefact_key)
    extractor_iri = "urn:weave:instances:extractor-doc"

    await write_artefact_entity(
        workspace.named_graph_iri, artefact_iri=artefact_iri, original_filename="doc.pdf",
        content_type="application/pdf", size_bytes=1234,
    )
    await start_ingest_activity(
        workspace.named_graph_iri, activity_iri=activity_iri, extractor_iri=extractor_iri,
        artefact_iri=artefact_iri, context={},
    )

    async with tenant_connection(tenant_id) as conn:
        job_id = await insert_job(
            conn,
            NewJob(
                tenant_id=tenant_id, workspace_id=workspace.id, artefact_iri=artefact_iri,
                kind="doc",
            ),
        )
        await store_update_job_status(
            conn,
            JobStatusUpdate(
                tenant_id=tenant_id, job_id=job_id, status="awaiting-review",
                activity_iri=activity_iri, extractor_iri=extractor_iri,
            ),
        )
        proposal_id = await insert_proposal(
            conn, NewProposal(tenant_id=tenant_id, job_id=job_id, ops=ops, confidence=0.9)
        )
    return job_id, proposal_id


async def test_artefact_upload_creates_prov_entity_and_no_draft_individual(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-01: real multipart upload, real S3 write, real prov graph --
    the artefact is a `prov:Entity` only, never a working-graph individual.
    """
    _ensure_corpus_bucket()
    tenant_id = _unique_tenant("ingest-upload")
    workspace = await _make_workspace(tenant_id, label="ingest")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, workspace=workspace, user_sub="u-author", role="author"
    )

    try:
        response = await client.post(
            "/api/ingest/artefacts",
            files={"file": ("doc.pdf", b"%PDF-1.4 fake content", "application/pdf")},
            headers=headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["artefact_iri"]
        assert body["job_id"]

        prov_turtle = await fetch_graph_turtle(prov_graph_iri(workspace.named_graph_iri))
        assert body["artefact_iri"] in prov_turtle
        assert "http://www.w3.org/ns/prov#Entity" in prov_turtle

        draft_turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        assert body["artefact_iri"] not in draft_turtle
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(prov_graph_iri(workspace.named_graph_iri))


async def test_oversize_upload_is_rejected_before_any_storage_call(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-10: nothing stored -- proven by an empty corpus-bucket listing
    under this artefact's tenant prefix.
    """
    _ensure_corpus_bucket()
    tenant_id = _unique_tenant("ingest-oversize")
    workspace = await _make_workspace(tenant_id, label="ingest")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, workspace=workspace, user_sub="u-author", role="author"
    )
    oversize = b"x" * (25 * 1024 * 1024 + 1)

    response = await client.post(
        "/api/ingest/artefacts",
        files={"file": ("big.pdf", oversize, "application/pdf")},
        headers=headers,
    )

    assert response.status_code == 422
    listing = s3_client().list_objects_v2(Bucket=_CORPUS_BUCKET, Prefix=f"{tenant_id}/")
    assert listing.get("Contents", []) == []


async def test_accepted_proposal_carries_prov_used_and_reuses_activity(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-05: accept dispatches through CE-WRITE-1 and attributes the
    commit to the *same* `activity_iri` the worker already started -- one
    activity, two prov moments, never a second `prov:startedAtTime`.
    """
    tenant_id = _unique_tenant("ingest-accept")
    workspace = await _make_workspace(tenant_id, label="ingest")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, workspace=workspace, user_sub="u-author", role="author"
    )
    ops: list[dict[str, object]] = [
        {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"},
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"},
        {"op": "add_edge", "subject_ref": "p1", "predicate": "performedBy", "object_ref": "a1"},
    ]

    try:
        _job_id, proposal_id = await _seed_awaiting_review_job(tenant_id, workspace, ops=ops)

        response = await client.post(f"/api/ingest/proposals/{proposal_id}/accept", headers=headers)

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["version_iri"].startswith(f"{workspace.named_graph_iri}:v")

        prov_turtle = await fetch_graph_turtle(prov_graph_iri(workspace.named_graph_iri))
        assert body["activity_iri"] in prov_turtle
        assert "http://www.w3.org/ns/prov#used" in prov_turtle
        # One activity, two prov moments -- exactly one startedAtTime for it.
        # Oxigraph groups Turtle output by subject (semicolon lists), so the
        # predicate isn't textually adjacent to the subject IRI -- but this
        # test's named graph holds exactly one activity, so counting the
        # predicate alone is an unambiguous proxy for "count on this activity".
        started_count = prov_turtle.count("http://www.w3.org/ns/prov#startedAtTime")
        assert started_count == 1

        async with tenant_connection(tenant_id) as conn:
            proposal_row = await get_proposal(conn, tenant_id=tenant_id, proposal_id=proposal_id)
        assert proposal_row is not None
        assert proposal_row.status == "accepted"
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(prov_graph_iri(workspace.named_graph_iri))


async def test_shacl_violation_on_accept_returns_422_and_leaves_graph_unchanged(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-06: a Process with no `performedBy` trips ProcessShape's
    Violation -- the working graph and the proposal's `pending` status must
    both be untouched.
    """
    tenant_id = _unique_tenant("ingest-violate")
    workspace = await _make_workspace(tenant_id, label="ingest")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, workspace=workspace, user_sub="u-author", role="author"
    )
    ops: list[dict[str, object]] = [
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}
    ]

    try:
        _job_id, proposal_id = await _seed_awaiting_review_job(tenant_id, workspace, ops=ops)
        pre_state = await fetch_graph_turtle(workspace.named_graph_iri)

        response = await client.post(f"/api/ingest/proposals/{proposal_id}/accept", headers=headers)

        assert response.status_code == 422
        assert response.json()["violations"]

        post_state = await fetch_graph_turtle(workspace.named_graph_iri)
        assert post_state == pre_state

        async with tenant_connection(tenant_id) as conn:
            proposal_row = await get_proposal(conn, tenant_id=tenant_id, proposal_id=proposal_id)
        assert proposal_row is not None
        assert proposal_row.status == "pending"
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(prov_graph_iri(workspace.named_graph_iri))


async def test_rejected_proposal_kept_for_audit_and_counted_in_job_summary(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-07: reject touches nothing but the proposal's own status --
    it's kept (not deleted) and counted in the job's `rejected` summary."""
    tenant_id = _unique_tenant("ingest-reject")
    workspace = await _make_workspace(tenant_id, label="ingest")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, workspace=workspace, user_sub="u-author", role="author"
    )
    ops: list[dict[str, object]] = [
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}
    ]

    try:
        job_id, proposal_id = await _seed_awaiting_review_job(tenant_id, workspace, ops=ops)

        response = await client.post(f"/api/ingest/proposals/{proposal_id}/reject", headers=headers)

        assert response.status_code == 200, response.text
        assert response.json() == {"id": proposal_id, "status": "rejected"}

        async with tenant_connection(tenant_id) as conn:
            proposal_row = await get_proposal(conn, tenant_id=tenant_id, proposal_id=proposal_id)
        assert proposal_row is not None
        assert proposal_row.status == "rejected"

        job_response = await client.get(f"/api/ingest/jobs/{job_id}", headers=headers)
        assert job_response.status_code == 200
        assert job_response.json()["summary"] == {"committed": 0, "rejected": 1, "skipped": 0}
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(prov_graph_iri(workspace.named_graph_iri))


async def test_ingest_jobs_and_proposals_are_invisible_cross_tenant(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-09, application layer: tenant B's JWT gets a plain 404 for
    tenant A's job/proposal ids, never a leaked 200/403.
    """
    tenant_a = _unique_tenant("ingest-tenant-a")
    tenant_b = _unique_tenant("ingest-tenant-b")
    workspace_a = await _make_workspace(tenant_a, label="ingest")
    workspace_b = await _make_workspace(tenant_b, label="ingest")
    headers_b = await _authed_headers(
        client, tenant_id=tenant_b, workspace=workspace_b, user_sub="u-b", role="author"
    )
    ops: list[dict[str, object]] = [
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}
    ]

    try:
        job_id, proposal_id = await _seed_awaiting_review_job(tenant_a, workspace_a, ops=ops)

        job_as_b = await client.get(f"/api/ingest/jobs/{job_id}", headers=headers_b)
        proposals_as_b = await client.get(f"/api/ingest/jobs/{job_id}/proposals", headers=headers_b)
        accept_as_b = await client.post(
            f"/api/ingest/proposals/{proposal_id}/accept", headers=headers_b
        )

        assert job_as_b.status_code == 404
        assert proposals_as_b.status_code == 404
        assert accept_as_b.status_code == 404
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(prov_graph_iri(workspace_a.named_graph_iri))


async def test_proposals_beyond_fifty_are_reachable_via_the_list_endpoint(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-04: 'paginated proposal rows' must mean every proposal is
    reachable, not just the first 50 -- `list_proposals_for_job`'s
    `limit=50` default is never overridden nor exposed as a router query
    param, so a job with 51+ proposals would silently hide the tail from
    every reviewer with no cursor/`has_more` signal that truncation
    happened. QA edge case added for TASK-012 (Category 5).
    """
    tenant_id = _unique_tenant("ingest-page")
    workspace = await _make_workspace(tenant_id, label="ingest")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, workspace=workspace, user_sub="u-author", role="author"
    )
    ops: list[dict[str, object]] = [
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}
    ]
    proposal_count = 51

    async with tenant_connection(tenant_id) as conn:
        job_id = await insert_job(
            conn,
            NewJob(
                tenant_id=tenant_id, workspace_id=workspace.id,
                artefact_iri="urn:weave:instances:artefact-pagination-fixture", kind="doc",
            ),
        )
        for _ in range(proposal_count):
            await insert_proposal(
                conn, NewProposal(tenant_id=tenant_id, job_id=job_id, ops=ops, confidence=0.9)
            )

    response = await client.get(f"/api/ingest/jobs/{job_id}/proposals", headers=headers)

    assert response.status_code == 200
    returned = response.json()["proposals"]
    assert len(returned) == proposal_count, (
        f"only {len(returned)}/{proposal_count} proposals reachable -- "
        "list_proposals_route never overrides list_proposals_for_job's limit=50 default nor "
        "exposes a pagination query param, so proposals past #50 are permanently invisible to "
        "any reviewer (AC-001-04 'paginated proposal rows')"
    )


async def test_ingest_tables_rls_backstop_blocks_unscoped_select(
    platform_stack: Path,
) -> None:
    """AC-001-09, DB layer: the RLS backstop -- migration 0040's `FORCE ROW
    LEVEL SECURITY` policy must hide tenant A's rows from a raw, unfiltered
    `SELECT` issued over tenant B's connection, proving isolation holds even
    against a query that forgot a `WHERE tenant_id = ...` clause (mirrors
    `test_tenancy_isolation.py::test_cross_tenant_read_isolation`).
    """
    tenant_a = _unique_tenant("ingest-rls-a")
    tenant_b = _unique_tenant("ingest-rls-b")
    workspace_a = await _make_workspace(tenant_a, label="ingest")
    workspace_b = await _make_workspace(tenant_b, label="ingest")
    ops: list[dict[str, object]] = [
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}
    ]

    try:
        await _seed_awaiting_review_job(tenant_a, workspace_a, ops=ops)
        await _seed_awaiting_review_job(tenant_b, workspace_b, ops=ops)

        async with tenant_connection(tenant_b) as conn:
            unscoped_jobs = await conn.fetch("SELECT tenant_id FROM ingest_jobs")
            unscoped_proposals = await conn.fetch("SELECT tenant_id FROM ingest_proposals")

        assert {r["tenant_id"] for r in unscoped_jobs} == {tenant_b}
        assert {r["tenant_id"] for r in unscoped_proposals} == {tenant_b}
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(prov_graph_iri(workspace_a.named_graph_iri))
        await clear_graph(workspace_b.named_graph_iri)
        await clear_graph(prov_graph_iri(workspace_b.named_graph_iri))

"""TASK-004 (ADR-002): sandbox-as-workspace provisioning -- the tenant-local
canonical Hammerbarn template and each user's lazy-forked, per-user sandbox.

Fork and canonical materialisation share one code path (`_apply_and_publish`)
-- ADR-002's "one implementation, three uses" (reset is TASK-005's third use).

**Attribution / DoR "demo service principal minted via PLAT-IDENTITY-1":**
this module mints a real registered principal via `ensure_agent_principal`
(the existing PLAT-IDENTITY-1 operation for "dynamic per-automation
principals" -- contracts.md PLAT-IDENTITY-1) and applies through the
in-process CE-WRITE-1 pipeline function directly, never over a second HTTP
hop back into the same running app. Two things make this both correct and
the lazy option, not a corner cut:

1. No FK ties `graph_versions`/`audit_events`/PROV attribution to a
   `principals` row, but the DoR item asks for a *minted* principal
   specifically -- so this module mints one for real, rather than
   fabricating a bare string, honouring `ApplyContext.principal_iri`'s own
   documented PR #20 concern (attribution must never be a spoofable, made-up
   value).
2. `enforce_workspace_role` (the RBAC gate the HTTP route applies) is
   deliberately NOT exercised here: fork/canonical-materialise are
   system-triggered internal operations, not a user's own CE-WRITE-1 call --
   the security-relevant boundary this task must prove is boundary 2
   (AC-004-06, a real *user* JWT hitting the real HTTP route), which is
   untouched by this module and tested against the unmodified route.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

import asyncpg

from weave_backend.authoring.bpmo import InvalidBpmoKindError
from weave_backend.identity.registry import ensure_agent_principal, human_principal_iri
from weave_backend.onboarding import store
from weave_backend.onboarding.hammerbarn_seed.compile import CompiledArtefact
from weave_backend.operations.pipeline import ApplyContext, apply_operations_request
from weave_backend.operations.versioning import publish_version
from weave_backend.schemas.operations import AddEdgeOp, ApplyRequest, Op, ViolationsResponse
from weave_backend.tenancy.members import MemberAlreadyActive, activate_member, invite_member
from weave_backend.tenancy.sessions import get_redis
from weave_backend.tenancy.workspaces import Workspace, create_workspace, get_workspace_by_slug

CANONICAL_SLUG = "hammerbarn-canonical"
_DEMO_SERVICE_IAM_ROLE_ARN = "urn:weave:demo-service:hammerbarn"


class SandboxForkFailed(Exception):
    """AC-004-03: raised by any step of the fork sequence before the
    pointer would be set. Callers must never call `store.set_sandbox_pointer`
    except after this whole sequence returns cleanly -- see module + store
    docstrings ("pointer-last is what makes AC-004-03 trivial").
    """


@dataclass(frozen=True)
class SandboxResult:
    workspace_id: str
    reused: bool


def sandbox_slug(user_sub: str) -> str:
    """Deterministic per-user slug -- a retry after a failed fork (AC-004-03)
    re-resolves the SAME workspace row (via `workspaces`'s own
    `(tenant_id, slug)` unique constraint) instead of leaking an orphan.
    """
    digest = hashlib.sha256(user_sub.encode()).hexdigest()[:16]
    return f"hammerbarn-sandbox-{digest}"


async def ensure_demo_service_principal(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> str:
    """PLAT-IDENTITY-1: mints (or refreshes) the one fixed demo-service agent
    principal used to attribute every fork/canonical/reset write.
    """
    return await ensure_agent_principal(
        conn,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        iam_role_arn=_DEMO_SERVICE_IAM_ROLE_ARN,
        display_name="Hammerbarn demo service",
    )


def _serialize_op(op: Op, resolved: dict[str, str]) -> Op:
    if isinstance(op, AddEdgeOp):
        return op.model_copy(
            update={
                "subject_ref": resolved.get(op.subject_ref, op.subject_ref),
                "object_ref": resolved.get(op.object_ref, op.object_ref),
            }
        )
    return op


async def _apply_and_publish(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    workspace: Workspace,
    actor_iri: str,
    artefact: CompiledArtefact,
) -> str:
    """The shared fork/canonical-materialise sequence: apply every batch
    (accumulating cross-batch `ref_map`s, same reasoning as
    `hammerbarn_seed.apply.apply_seed`), then publish the final draft.
    Raises `SandboxForkFailed` on the first SHACL-violating batch or a
    publish that doesn't land -- both leave the caller's pointer untouched.
    """
    version_iri = ""
    resolved: dict[str, str] = {}
    for index, batch in enumerate(artefact.batches):
        ctx = ApplyContext(
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            named_graph_iri=workspace.named_graph_iri,
            conn=conn,
            principal_iri=actor_iri,
            principal_type="agent",
        )
        request = ApplyRequest(
            operations=[_serialize_op(op, resolved) for op in batch],
            actor=actor_iri,
            target="draft",
            idempotency_key=f"hammerbarn-{artefact.semver}:{workspace.id}:batch:{index}",
        )
        try:
            outcome = await apply_operations_request(ctx, request, get_redis())
        except InvalidBpmoKindError as exc:
            raise SandboxForkFailed(f"batch {index} rejected: {exc}") from exc
        if isinstance(outcome, ViolationsResponse):
            raise SandboxForkFailed(f"batch {index} rejected: {outcome.violations!r}")
        version_iri = outcome.version_iri
        resolved.update(outcome.ref_map)

    published = await publish_version(
        conn, tenant_id=tenant_id, workspace_id=workspace.id, version_iri=version_iri
    )
    if published is None:
        raise SandboxForkFailed(f"publish of {version_iri} did not land")
    return version_iri


async def provision_canonical_template(
    conn: asyncpg.Connection, *, tenant_id: str, artefact: CompiledArtefact
) -> Workspace:
    """Idempotent: a second call for the same tenant just returns the
    existing template workspace (keyed by the `(tenant_id, slug)` unique
    constraint -- no separate tracking row needed). No `workspace_members`
    row is ever granted here, so it stays 403-to-everyone-but-the-demo-
    service-principal and the content-admin's own separately-managed
    invite -- "existing 403 machinery", not new permission code (ADR-002).
    """
    existing = await get_workspace_by_slug(conn, tenant_id=tenant_id, slug=CANONICAL_SLUG)
    if existing is not None:
        return existing
    workspace = await create_workspace(
        conn, tenant_id=tenant_id, slug=CANONICAL_SLUG, display_name="Hammerbarn Canonical"
    )
    actor_iri = await ensure_demo_service_principal(
        conn, tenant_id=tenant_id, workspace_id=workspace.id
    )
    await _apply_and_publish(
        conn, tenant_id=tenant_id, workspace=workspace, actor_iri=actor_iri, artefact=artefact
    )
    return workspace


async def ensure_sandbox(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    user_sub: str,
    user_iri: str,
    artefact: CompiledArtefact,
) -> SandboxResult:
    """AC-004-02: lazy fork on first access, idempotent reuse thereafter.
    AC-004-03: any failure raises `SandboxForkFailed` before the pointer is
    ever touched -- see `store.set_sandbox_pointer`'s docstring.
    """
    # ponytail: `user_sub` and `user_iri` both name the same caller (the
    # JWT `sub` and its PLAT-IDENTITY-1 principal IRI), passed separately
    # only because callers need both forms. Check they actually agree
    # rather than trusting two separate route-supplied strings to stay in
    # sync -- a mismatch here would silently fork/attribute the wrong
    # user's sandbox. Not `assert` (S101: stripped under -O, wrong tool for
    # a caller-input invariant).
    if user_iri != human_principal_iri(user_sub):
        raise ValueError("user_iri/user_sub principal mismatch")

    existing_id = await store.get_sandbox_workspace_id(conn, tenant_id=tenant_id, user_id=user_iri)
    if existing_id is not None:
        return SandboxResult(workspace_id=existing_id, reused=True)

    slug = sandbox_slug(user_sub)
    workspace = await get_workspace_by_slug(conn, tenant_id=tenant_id, slug=slug)
    if workspace is None:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug=slug, display_name="Hammerbarn Demo"
        )

    # ponytail: sandbox is the user's own workspace, so they get "author" on
    # it directly rather than routing through the human invite-then-accept
    # flow -- invite_member's own (tenant_id, workspace_id, email) upsert
    # already makes this idempotent across retries; MemberAlreadyActive just
    # means an earlier fork attempt already granted it.
    member_email = f"{user_sub}@sandbox.weave.local"
    try:
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, email=member_email, role="author"
        )
        await activate_member(
            conn, workspace_id=workspace.id, email=member_email, user_sub=user_sub
        )
    except MemberAlreadyActive:
        pass

    actor_iri = await ensure_demo_service_principal(
        conn, tenant_id=tenant_id, workspace_id=workspace.id
    )
    await _apply_and_publish(
        conn, tenant_id=tenant_id, workspace=workspace, actor_iri=actor_iri, artefact=artefact
    )
    await store.set_sandbox_pointer(
        conn,
        tenant_id=tenant_id,
        user_id=user_iri,
        workspace_id=workspace.id,
        semver=artefact.semver,
    )
    return SandboxResult(workspace_id=workspace.id, reused=False)

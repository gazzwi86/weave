"""BE-V1-TASK-005 (BE-SDK-1 delivery, E8-S5/FR-059): trigger/run/ack
orchestration wrapping the TASK-004 pipeline (`sdkgen.pipeline.generate_sdk`)
in the delivery machinery -- CE-DIFF-1 breaking-span refusal, the
`sdk_breaking_ack` HITL ack, BE-ARTEFACT-1 provenance stamping,
`{ce_version_tag}+build.{n}` versioning, and the single atomic
`ScmDriver.commit_workspace` + projects-bookkeeping transaction (AC-5).

`run_sdk_generation` (the trigger route's `BackgroundTasks` callback) and
`approve_sdk_breaking_ack` (the HITL ack-resume path, routed in from
`build/hitl.py`) both funnel into `_generate_and_commit` -- the ONE
`commit_workspace` call site DoD requires. Every DB write here opens its
OWN `tenant_connection` (never a connection borrowed from the request that
enqueued the background task): Starlette runs `BackgroundTasks` after the
response has already been sent, by which point the request's own
connection is already released back to the pool.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Protocol

import asyncpg
import httpx

# GREEN-phase imports: skeleton bodies below don't reference these yet
# (`raise NotImplementedError`), so ruff's unused-import check needs the
# per-line waiver -- every name is either wired in during GREEN or is the
# monkeypatch target a RED-phase test already patches by attribute
# (`monkeypatch.setattr(sdk_trigger, "name", ...)`).
from weave_backend.build.gates import GateRecord, record_gate  # noqa: F401
from weave_backend.build.hitl import (  # noqa: F401
    HitlGateContext,
    SelfApprovalNotPermitted,
    fire_hitl_gate,
)
from weave_backend.db.pool import tenant_connection  # noqa: F401
from weave_backend.generation.sdk_store import (  # noqa: F401
    SdkGenerationRun,
    get_sdk_run,
    insert_sdk_generation_run,
    lock_latest_sdk_run,
    update_sdk_run_status,
)
from weave_backend.identity.registry import get_principal
from weave_backend.projects.ce_version_client import get_ontology_diff  # noqa: F401
from weave_backend.projects.model import Project, get_project  # noqa: F401
from weave_backend.repo_bootstrap.drivers import RepoHandle  # noqa: F401
from weave_backend.repo_bootstrap.service import (  # noqa: F401
    BUILD_SERVICE_PRINCIPAL_IRI,
    RepoBootstrapDeps,
)
from weave_backend.repo_bootstrap.store import fetch_project_repo_row  # noqa: F401
from weave_backend.sdkgen.ir import CeVersionPin
from weave_backend.sdkgen.pipeline import generate_sdk  # noqa: F401
from weave_backend.sdkgen.provenance import (  # noqa: F401
    build_sdk_provenance_header,
    collect_iris,
    stamp_provenance,
)

_SDK_GENERATION_EVIDENCE = "sdk_breaking_change"


class _HasPrincipalType(Protocol):
    @property
    def type(self) -> str: ...


@dataclass(frozen=True)
class SdkAckDeps:
    """Bundles `approve_sdk_breaking_ack`'s two injection seams (Law E:
    max 5 params) -- `resolve_principal` is threaded uniformly through
    `build/hitl.py::handle_hitl_response` for every gate type (mirrors
    `rich_scaffold.approve_env_verification`'s D9 shape); `repo_deps` is
    the SCM/secret seam `run_sdk_generation` also uses, so ack-resume can
    swap in a stub driver without a real GitHub call.
    """

    resolve_principal: Callable[..., Awaitable[_HasPrincipalType]] = get_principal
    repo_deps: RepoBootstrapDeps | None = None


class ProjectHasNoPinnedVersion(Exception):
    """422: `POST .../sdk-generations` on a project with no pinned CE version."""


class SdkGenerationInFlight(Exception):
    """409: an SDK run for this project is already `queued|running|breaking_hold`."""


class SdkGenerationRunNotFound(Exception):
    """The ack-resume path's `run_id` doesn't resolve for this tenant."""


def _ce_version_tag(version_iri: str) -> str:
    """`urn:weave:ce:v1` -> `v1` -- the URN's last colon-delimited segment.
    Not `sdkgen.ir._local_name` (that helper splits on `/`/`#`, the wrong
    separator for these colon-delimited version URNs).
    """
    return version_iri.rsplit(":", 1)[-1]


async def trigger_sdk_generation(
    conn: asyncpg.Connection, *, project: Project, tenant_id: str
) -> SdkGenerationRun:
    """AC-1: enqueue a new `queued` run. Caller (router) already holds the
    `conn`'s transaction open, so `lock_latest_sdk_run`'s `FOR UPDATE`
    genuinely serialises concurrent triggers within it (Implementation
    Hints: lock the newest run row, not an advisory flag).
    """
    raise NotImplementedError


async def run_sdk_generation(
    *,
    tenant_id: str,
    run_id: str,
    project_iri: str,
    ce_client: httpx.AsyncClient | None = None,
    deps: RepoBootstrapDeps | None = None,
) -> None:
    """The trigger route's `BackgroundTasks` entry point (pseudocode's
    `run_generation`): AC-2/AC-4 breaking-span check, then AC-5/AC-6
    generate+commit via `_generate_and_commit`. No `auth_header` param
    (unlike `requests/pipeline.py`'s CE calls) -- CE-DIFF-1 here is always
    read by the build-engine service actor, not on behalf of the request's
    human principal, and this callback runs after the request that
    enqueued it has already returned (Starlette `BackgroundTasks`).
    """
    raise NotImplementedError


async def approve_sdk_breaking_ack(
    conn: asyncpg.Connection,
    *,
    run_id: str,
    tenant_id: str,
    approving_principal_iri: str,
    ack_deps: SdkAckDeps | None = None,
) -> None:
    """AC-3: the `sdk_breaking_ack` HITL release path -- mirrors
    `rich_scaffold.approve_env_verification`'s D9 shape (the submitting
    principal is always the automated `BUILD_SERVICE_PRINCIPAL_IRI`, so
    "non-self" collapses to "approver must resolve to a human principal").
    Persists the `gate_results` row, then resumes straight to
    `_generate_and_commit` (pseudocode's `on_ack`) -- the breaking check
    itself is never re-run post-ack. `ack_deps` defaults to `SdkAckDeps()`
    (real principal resolution + `repo_bootstrap.service.DEFAULT_DEPS`);
    see `SdkAckDeps` for why the two seams are bundled (Law E 5-param
    budget).
    """
    raise NotImplementedError


async def _generate_and_commit(
    *, tenant_id: str, run_id: str, project: Project, pin: CeVersionPin, deps: RepoBootstrapDeps
) -> None:
    """AC-5/AC-6: the SINGLE `commit_workspace` call site -- both
    `run_sdk_generation` (first-time/no-breaking-change path) and
    `approve_sdk_breaking_ack` (post-ack resume) funnel through here.

    On any failure, the in-flight work transaction is left to roll back and
    a FRESH `tenant_connection` records `status='failed'` -- asyncpg aborts
    a transaction on its first error, so the failure row can never share the
    transaction that failed (it would itself be rolled back).
    """
    raise NotImplementedError

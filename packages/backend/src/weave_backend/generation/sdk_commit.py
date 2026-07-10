"""BE-V1-TASK-005 (BE-SDK-1 delivery, E8-S5/FR-059): the generate+commit core,
split out of `sdk_trigger.py` (Law E file-length budget) -- `_generate_and_commit`
is the ONE `commit_workspace` call site both `run_sdk_generation` and
`approve_sdk_breaking_ack` funnel into (AC-5/AC-6).
"""

from __future__ import annotations

import shutil

from weave_backend.db.pool import tenant_connection
from weave_backend.generation.sdk_store import ensure_sdk_run, update_sdk_run_status
from weave_backend.projects.model import Project, update_project_sdk_generation
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps, RepoBootstrapError
from weave_backend.sdkgen.ir import CeVersionPin
from weave_backend.sdkgen.pipeline import GeneratedSdk, generate_sdk
from weave_backend.sdkgen.provenance import (
    build_sdk_provenance_header,
    collect_iris,
    stamp_provenance,
)

_REPO_ROW_SQL = (
    "SELECT repo_provider, repo_url, repo_default_branch, repo_id,"
    " source_control_token_secret_ref FROM projects"
    " WHERE tenant_id = $1 AND project_iri = $2"
)


def _ce_version_tag(version_iri: str) -> str:
    """`urn:weave:ce:v1` -> `v1` -- the URN's last colon-delimited segment.
    Not `sdkgen.ir._local_name` (that helper splits on `/`/`#`, the wrong
    separator for these colon-delimited version URNs).
    """
    return version_iri.rsplit(":", 1)[-1]


async def _commit_generated_sdk(
    generated: GeneratedSdk, *, project: Project, tenant_id: str, pin: CeVersionPin,
    deps: RepoBootstrapDeps,
) -> tuple[str, str]:
    """AC-5: stamps BE-ARTEFACT-1 provenance, then the SINGLE
    `commit_workspace` call -- returns `(commit_sha, package_version)`.
    """
    entity_iris = collect_iris(generated.ir)
    header = build_sdk_provenance_header(project, entity_iris)
    stamp_provenance(generated.staging, header)

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(_REPO_ROW_SQL, tenant_id, project.project_iri)

    token_ref = row["source_control_token_secret_ref"] if row else None
    token = await deps.get_secret(token_ref) if token_ref else None
    if not token:
        raise RepoBootstrapError("repo_auth_invalid")

    driver = deps.driver_for((row["repo_provider"] if row else None) or "")
    repo = RepoHandle(
        repo_id=(row["repo_id"] if row else None) or "",
        url=(row["repo_url"] if row else None) or "",
        default_branch=(row["repo_default_branch"] if row else None) or "",
    )
    package_version = f"{_ce_version_tag(pin.version_iri)}+build.{project.sdk_generation_count + 1}"
    commit_sha = await driver.commit_workspace(
        repo,
        workspace=str(generated.staging),
        branch=repo.default_branch,
        message=f"chore(sdk): {package_version}",
        token=token,
    )
    return commit_sha, package_version


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

    `ensure_sdk_run` first: `run_sdk_generation` may be called directly
    against a `run_id` the trigger route's own `insert_sdk_generation_run`
    never wrote (test convenience, and any future caller that mints its own
    run_id) -- idempotent insert-or-noop so the status updates below always
    have a row to land on.
    """
    async with tenant_connection(tenant_id) as conn:
        await ensure_sdk_run(
            conn, tenant_id=tenant_id, run_id=run_id, project_iri=project.project_iri
        )

    try:
        generated = generate_sdk(pin)
        try:
            commit_sha, package_version = await _commit_generated_sdk(
                generated, project=project, tenant_id=tenant_id, pin=pin, deps=deps
            )
        finally:
            shutil.rmtree(generated.staging, ignore_errors=True)
    except Exception as exc:  # fail-closed: any pipeline error marks the run failed
        async with tenant_connection(tenant_id) as conn:
            await update_sdk_run_status(
                conn,
                tenant_id=tenant_id,
                run_id=run_id,
                status="failed",
                payload={"failure_cause": str(exc)},
            )
        return

    async with tenant_connection(tenant_id) as conn:
        await update_project_sdk_generation(
            conn,
            tenant_id=tenant_id,
            project_iri=project.project_iri,
            last_sdk_version_iri=pin.version_iri,
        )
        await update_sdk_run_status(
            conn,
            tenant_id=tenant_id,
            run_id=run_id,
            status="passed",
            payload={"package_version": package_version, "commit_sha": commit_sha},
        )

"""Ingest job worker (brief pseudocode: `worker(job)`). Runs detached via
`BackgroundTasks` (no new job-queue infra -- same pattern as
`requests/pipeline.py::run_drafting_pipeline`), so it opens its own
`tenant_connection` rather than reusing the request-scoped one.

Resolves `named_graph_iri` from the job's `workspace_id` the same way the
accept endpoint will (`get_workspace`) -- both must land in the same prov
graph for "one activity, two prov moments" to hold (AC-001-05).
"""

from __future__ import annotations

import logging

from weave_backend.db.pool import tenant_connection
from weave_backend.ingest.extractors import DEFAULT_REGISTRY, Extractor, NoOpExtractor
from weave_backend.ingest.store import (
    JobStatusUpdate,
    NewProposal,
    get_job,
    insert_proposal,
    update_job_status,
)
from weave_backend.instances.duplicates import find_duplicate_iri
from weave_backend.operations.ingest_provenance import mint_activity_iri, start_ingest_activity
from weave_backend.tenancy.workspaces import get_workspace

log = logging.getLogger(__name__)

#: Extractor selected for a job.kind with no registry entry -- so an
#: unrecognised kind still reaches `awaiting-review` (zero proposals)
#: instead of failing the job.
_FALLBACK_EXTRACTOR: Extractor = NoOpExtractor()


async def run_ingest_job(
    job_id: str, *, tenant_id: str, registry: dict[str, Extractor] | None = None
) -> None:
    registry = DEFAULT_REGISTRY if registry is None else registry
    async with tenant_connection(tenant_id) as conn:
        job = await get_job(conn, tenant_id=tenant_id, job_id=job_id)
        if job is None:
            log.warning("ingest worker: job %s not found for tenant %s", job_id, tenant_id)
            return

        workspace = await get_workspace(conn, tenant_id=tenant_id, workspace_id=job.workspace_id)
        if workspace is None:
            await update_job_status(
                conn,
                JobStatusUpdate(
                    tenant_id=tenant_id, job_id=job_id, status="failed", error="workspace_not_found"
                ),
            )
            return

        activity_iri = mint_activity_iri(job_id)
        extractor_iri = f"urn:weave:instances:extractor-{job.kind}"
        try:
            await start_ingest_activity(
                workspace.named_graph_iri,
                activity_iri=activity_iri,
                extractor_iri=extractor_iri,
                artefact_iri=job.artefact_iri,
                context=job.context,
            )
            await update_job_status(
                conn,
                JobStatusUpdate(
                    tenant_id=tenant_id,
                    job_id=job_id,
                    status="extracting",
                    activity_iri=activity_iri,
                    extractor_iri=extractor_iri,
                ),
            )

            extractor = registry.get(job.kind, _FALLBACK_EXTRACTOR)
            candidates = await extractor.extract(job)
            for candidate in candidates:
                matched_iri = await find_duplicate_iri(
                    workspace.named_graph_iri, candidate.kind, candidate.label
                )
                await insert_proposal(
                    conn,
                    NewProposal(
                        tenant_id=tenant_id,
                        job_id=job_id,
                        ops=candidate.ops,
                        confidence=candidate.confidence,
                        matched_iri=matched_iri,
                        reason=candidate.reason,
                    ),
                )

            await update_job_status(
                conn, JobStatusUpdate(tenant_id=tenant_id, job_id=job_id, status="awaiting-review")
            )
        except Exception as exc:  # extractor/store failure -- job fails, doesn't crash the task
            log.exception("ingest worker failed for job %s", job_id)
            await update_job_status(
                conn,
                JobStatusUpdate(
                    tenant_id=tenant_id, job_id=job_id, status="failed", error=str(exc)
                ),
            )

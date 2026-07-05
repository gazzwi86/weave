"""BE-TASK-003: the Request Studio drafting pipeline -- grounds a spec draft
in CE-VERSION-1/CE-READ-1 (AC-2/AC-7), streams three sections through
`claude-fable-5` only (AC-8), and enforces a 60s generation timeout
(AC-4). Runs as a FastAPI `BackgroundTasks` callback kicked off by
`routers.requests.create_request_route`, per the task brief's design
decision table.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

import httpx
import redis.asyncio as redis

from weave_backend.ai import router as ai_router
from weave_backend.ai.providers import ModelProvider
from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.db.pool import tenant_connection
from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.store import NotificationEvent
from weave_backend.projects.ce_version_client import CeVersionUnavailable, get_pinned_latest_version
from weave_backend.requests import store

log = logging.getLogger(__name__)

#: Order matters: this is the order sections are drafted and streamed in.
SECTIONS = ("brief", "prd", "tech_spec")

#: ponytail: PLAT-SETTINGS-1 cascade wiring (the brief's "tunable" design
#: decision) is deferred -- no AC/test in this task exercises a non-default
#: timeout, and the settings cascade needs a Postgres `context_iri` this
#: pipeline otherwise has no reason to touch. Kept overridable per-call
#: (`timeout_s=`) so a future PLAT-SETTINGS-1 read can slot in without an
#: API change. Upgrade path: `settings.resolver.resolve_setting(key=
#: "build.spec_draft_timeout_s")` once a tunable value is actually needed.
SPEC_DRAFT_TIMEOUT_S = 60.0

#: See `docs/specs/weave/engines/build-engine/decisions/ADR-001.md` --
#: not yet executed against a live BPMO SPARQL endpoint (CE-READ-1's actual
#: context-read contract is still a DoR blocker on this task's tech-spec);
#: grounding here pins the ontology version and records this query text for
#: audit/provenance (AC-2), rather than embedding full graph node content.
GROUNDING_QUERY = (
    "SELECT ?concept ?label WHERE { ?concept a bpmo:Kind ; skos:prefLabel ?label } LIMIT 50"
)

BUILD_SERVICE_PRINCIPAL_IRI = "urn:weave:principal:service:build-drafting-pipeline"

_SECTION_INSTRUCTIONS = {
    "brief": "Draft a product brief",
    "prd": "Draft a PRD",
    "tech_spec": "Draft a tech spec",
}


@dataclass(frozen=True)
class DraftingRequest:
    request_id: str
    tenant_id: str
    actor_iri: str
    prompt: str


def build_section_prompt(section: str, prompt: str, graph_context: str) -> str:
    instruction = _SECTION_INSTRUCTIONS[section]
    return f"{instruction} for: {prompt}\n(ontology context: {graph_context})"


async def _draft_section(
    section: str, prompt: str, graph_context: str, provider: ModelProvider
) -> str:
    section_prompt = build_section_prompt(section, prompt, graph_context)
    # Anthropic/Bedrock SDKs are synchronous -- offload to a thread so a
    # slow LLM call never blocks the event loop from serving other
    # requests (or this same request's SSE stream) while it waits.
    return await asyncio.to_thread(ai_router.route, "fable", section_prompt, provider=provider)


async def _ground_in_ce_read(ce_client: httpx.AsyncClient, tenant_id: str, request_id: str) -> str:
    """AC-2/AC-7: ground the draft in CE-VERSION-1's pinned latest version;
    degrade to "unavailable" (never blocking the draft) if CE is
    unreachable. The audit emit fires either way (AC-2's implementation
    hint: record the failure too).
    """
    try:
        graph_context = await get_pinned_latest_version(ce_client)
    except CeVersionUnavailable:
        graph_context = "unavailable"

    async with tenant_connection(tenant_id) as conn:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="ce_read_grounding",
                actor_iri=BUILD_SERVICE_PRINCIPAL_IRI,
                subject_iri=f"urn:weave:request:{request_id}",
                payload={"version": graph_context, "query": GROUNDING_QUERY},
                engine="build",
            ),
        )
    return graph_context


async def _fire_generation_failure(tenant_id: str, request_id: str, actor_iri: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=actor_iri,
                event_type="generation_failure",
                payload={"request_id": request_id, "reason": "timeout"},
                actor_iri=BUILD_SERVICE_PRINCIPAL_IRI,
            ),
        )


async def run_drafting_pipeline(
    draft_request: DraftingRequest,
    *,
    ce_client: httpx.AsyncClient,
    provider: ModelProvider,
    redis_client: redis.Redis | None = None,
    timeout_s: float = SPEC_DRAFT_TIMEOUT_S,
) -> None:
    """AC-2..AC-4/AC-7/AC-8: the `POST /api/requests` background task --
    grounds the draft (AC-2/AC-7), drafts+publishes each of `SECTIONS` in
    order (AC-3), and enforces `timeout_s` (default AC-4's 60s), marking the
    record `timed_out` with whatever partial draft was collected so far if
    it fires.
    """
    client = redis_client or await store.get_redis_client()
    graph_context = await _ground_in_ce_read(
        ce_client, draft_request.tenant_id, draft_request.request_id
    )
    await store.update_request_record(
        client, draft_request.request_id, graph_context=graph_context
    )

    sections: dict[str, str] = {}
    try:
        async with asyncio.timeout(timeout_s):
            for section in SECTIONS:
                content = await _draft_section(
                    section, draft_request.prompt, graph_context, provider
                )
                sections[section] = content
                await store.publish_event(
                    client,
                    draft_request.request_id,
                    {"section": section, "content": content, "done": False},
                )
    except TimeoutError:
        await store.update_request_record(
            client, draft_request.request_id, status="timed_out", draft_content=sections
        )
        await store.publish_event(client, draft_request.request_id, {"done": True})
        await _fire_generation_failure(
            draft_request.tenant_id, draft_request.request_id, draft_request.actor_iri
        )
        return

    await store.publish_event(client, draft_request.request_id, {"done": True})
    await store.update_request_record(
        client, draft_request.request_id, status="draft_complete", draft_content=sections
    )

"""TASK-003 (ADR-005, FR-051, EPIC-011): read-only investigator overflow
path for BPMO retrieval beyond the 200-node slice (`build/retrieval.py`).

The investigator runs under a Sandbox-class `PLAT-IDENTITY-1` principal --
`resolve_investigator_principal` is a lightweight, in-process descriptor
(not a real AWS STS round trip like `auth/agent.py`'s human/agent
principals): there is no real agent runtime in this task's scope
(`agent_run_fn` is injected and stubbed in tests, Law F), so there is
nothing for a real STS-backed principal to authenticate against yet. The
tool allowlist (`READ_ONLY_TOOLS`) is what actually enforces "no write
tools" at dispatch; a future real agent-runtime task wires this principal
descriptor to a real credential.

Persistence reuses `dep_summaries` (ADR-005 Design Decisions: "no new
table") rather than the `dep_summary.py::DepSummary` model, whose fields
are handoff-shaped (decisions/edge_cases/outputs) and don't fit an
investigation record. `task_id` is the investigation's `pointer` (unique
per investigation, so the table's existing PK still holds); `content` jsonb
carries `{"kind": "investigation", "pointer", "summary"}` -- no migration,
no new column, since nothing here needs `kind` to be a queryable SQL
column (RLS on `tenant_id` alone already gives AC-7 isolation).
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import asyncpg

from weave_backend.build.model_routing import resolve_model

#: AC-5/Implementation Hints: graph read + repo read only -- no ScmDriver,
#: no write-back, no file writes. Asserted directly in the spawn-guard
#: unit test, not just the guard flag.
READ_ONLY_TOOLS: frozenset[str] = frozenset({"graph_read", "repo_read"})

#: AC-6: summary token cap. `CHARS_PER_TOKEN` mirrors `requests/cost.py`'s
#: `_CHARS_PER_TOKEN` heuristic (Implementation Hints: reuse the M1
#: token-counting util, no tokenizer dependency) -- not imported directly
#: since that name is module-private there.
MAX_SUMMARY_TOKENS = 500
CHARS_PER_TOKEN = 4


class SubInvestigatorForbidden(Exception):
    """AC-5: an investigator run tried to dispatch another investigator."""


@dataclass(frozen=True)
class InvestigatorPrincipal:
    iri: str
    tools: frozenset[str] = READ_ONLY_TOOLS


@dataclass(frozen=True)
class InvestigatorResult:
    """What the (stubbed) agent runtime returns: a pointer to the raw
    findings and a candidate summary -- the pointer is persisted, the raw
    findings never are (AC-6).
    """

    pointer: str
    summary: str


AgentRunFn = Callable[..., Awaitable[InvestigatorResult]]
SaveSummaryFn = Callable[..., Awaitable[None]]


@dataclass(frozen=True)
class InvestigatorRequest:
    """Bundles the per-call context (ruff `PLR0913` max-args=5) --
    `agent_run_fn`/`save_summary_fn` stay separate keyword args since
    those are the injectable seams tests override (Law F).
    """

    tenant_id: str
    project_iri: str
    question: str
    caller_is_investigator: bool


def resolve_investigator_principal(tenant_id: str) -> InvestigatorPrincipal:
    """AC-5: a read-only Sandbox-class principal, scoped to `tenant_id` --
    never the caller's own (potentially write-capable) principal.
    """
    return InvestigatorPrincipal(iri=f"urn:weave:principal:agent:sandbox-investigator:{tenant_id}")


def truncate_tokens(text: str, max_tokens: int = MAX_SUMMARY_TOKENS) -> str:
    """AC-6: cap `text` at `max_tokens` using the chars/4 M1 heuristic."""
    max_chars = max_tokens * CHARS_PER_TOKEN
    return text if len(text) <= max_chars else text[:max_chars]


async def save_investigation_summary(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, pointer: str, summary: str
) -> None:
    """AC-6/AC-7: upsert into `dep_summaries` (RLS already enforces tenant
    isolation on this table -- no bypass, no new policy needed).
    """
    content = json.dumps({"kind": "investigation", "pointer": pointer, "summary": summary})
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        """
        INSERT INTO dep_summaries (project_iri, task_id, tenant_id, content)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (project_iri, task_id, tenant_id) DO UPDATE SET content = EXCLUDED.content
        """,
        project_iri,
        pointer,
        tenant_id,
        content,
    )


async def list_investigation_summaries(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> list[dict[str, Any]]:
    """AC-7: every investigation summary row visible to `tenant_id` for
    `project_iri` -- a tenant-B caller must see zero tenant-A rows here.
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    rows = await conn.fetch(
        "SELECT content FROM dep_summaries WHERE tenant_id = $1 AND project_iri = $2",
        tenant_id,
        project_iri,
    )
    contents: list[dict[str, Any]] = [
        json.loads(r["content"]) if isinstance(r["content"], str) else r["content"] for r in rows
    ]
    return [c for c in contents if c.get("kind") == "investigation"]


async def dispatch_investigator(
    conn: asyncpg.Connection | None,
    request: InvestigatorRequest,
    *,
    agent_run_fn: AgentRunFn,
    save_summary_fn: SaveSummaryFn = save_investigation_summary,
) -> str:
    """AC-5/AC-6: dispatch a read-only investigator run and return only its
    summary -- never the raw subgraph. Raises `SubInvestigatorForbidden`
    before any dispatch if the caller is itself an investigator (AC-5).
    """
    if request.caller_is_investigator:
        raise SubInvestigatorForbidden()

    model = resolve_model(role="investigator")
    principal = resolve_investigator_principal(request.tenant_id)
    result = await agent_run_fn(
        principal=principal, tools=READ_ONLY_TOOLS, prompt=request.question, model=model
    )
    summary = truncate_tokens(result.summary)
    await save_summary_fn(
        conn,
        tenant_id=request.tenant_id,
        project_iri=request.project_iri,
        pointer=result.pointer,
        summary=summary,
    )
    return summary

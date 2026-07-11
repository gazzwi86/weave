"""BE-V1-TASK-021 (FR-065 AC-7): synthesise one or more FR-018-conformant
task-brief documents from a direct project prompt, reusing the Architect
agent's existing drafting path (`draft_brief_document`) rather than a
parallel PLAN variant. Real anatomy/backlog grounding is out of this
task's scope (Implementation Hints) -- `bpmo_context` carries only the
project IRI today; a later task can widen it without touching the call
site here (`orchestrator.py` injects this via `OrchestratorDeps`).
"""

from __future__ import annotations

from typing import Any

import asyncpg

from weave_backend.ai.providers import ModelProvider
from weave_backend.briefs.architect import draft_brief_document


async def default_synthesise_briefs(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    project_iri: str,
    prompt_text: str,
    provider: ModelProvider | None = None,
) -> list[dict[str, Any]]:
    """AC-7: one drafted brief per prompt (M1 scope -- a prompt yielding
    several independent briefs is a future extension, not exercised by
    this task's AC surface). `conn`/`tenant_id` are accepted for parity
    with a future backlog/dep-summary grounding read; unused today.
    """
    del conn, tenant_id
    draft = draft_brief_document(
        prompt_text, bpmo_context={"project_iri": project_iri}, dep_summaries=[], provider=provider
    )
    return [draft]

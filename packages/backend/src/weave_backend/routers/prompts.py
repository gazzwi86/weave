"""BE-V1-TASK-021 (FR-065): `POST /api/projects/{project_iri}/prompts` --
role-gated direct project prompt that enqueues a `trigger="prompt"`
dark-factory run through the existing M1 lifecycle (no second orchestrator
entry point -- `run_dark_factory` is the same one `routers/runs.py` calls).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.orchestrator import run_dark_factory
from weave_backend.build.state_spine import start_or_resume_run
from weave_backend.db.pool import tenant_connection
from weave_backend.pm import prompts as prompts_store
from weave_backend.projects.model import get_project
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.routers.runs import _effective_turn_cap
from weave_backend.schemas.prompts import CreatePromptRequest, CreatePromptResponse
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri

router = APIRouter(tags=["prompts"])

#: AC-6's default -- overridable per-project via `PLAT-SETTINGS-1`
#: (`build.prompt_max_length`), same cascade `_effective_turn_cap` uses.
DEFAULT_PROMPT_MAX_LENGTH = 4000


def prompt_text_valid(text: str, *, max_length: int) -> bool:
    """AC-6: empty (after stripping whitespace) or over the length cap is
    invalid -- a pure predicate so the boundary is unit-testable without a
    DB connection.
    """
    stripped = text.strip()
    return bool(stripped) and len(stripped) <= max_length


async def _effective_prompt_max(conn, *, tenant_id: str, project_iri: str) -> int:  # type: ignore[no-untyped-def]
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key="build.prompt_max_length", context_iri=project_iri
        )
    except (SettingNotFound, InvalidScopeIri):
        return DEFAULT_PROMPT_MAX_LENGTH
    return int(resolved.value)


async def _run_prompt_in_background(
    *, tenant_id: str, project_iri: str, run_id: str, turn_cap: int, prompt_id: str, prompt_text: str
) -> None:
    """AC-4: dispatched via `BackgroundTasks` so the 202 response returns
    before the run completes -- a synchronous `run_dark_factory` call
    (as `/runs` uses) would leave nothing for the Dashboard's status chip
    to observe transitioning.
    """
    async with tenant_connection(tenant_id) as conn:
        spine = await start_or_resume_run(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            run_id=run_id,
            turn_cap=turn_cap,
            trigger="prompt",
            prompt_context={"prompt_id": prompt_id, "prompt_text": prompt_text},
        )
        await run_dark_factory(conn, spine, tenant_id=tenant_id)


@router.post(
    "/api/projects/{project_iri}/prompts", status_code=202, response_model=CreatePromptResponse
)
async def create_prompt_route(
    project_iri: str,
    body: CreatePromptRequest,
    background_tasks: BackgroundTasks,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.PROMPT))],
) -> CreatePromptResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if project is None:
            raise HTTPException(status_code=404, detail={"error": "not_found"})

        prompt_max = await _effective_prompt_max(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
        text = body.prompt_text.strip()
        if not prompt_text_valid(text, max_length=prompt_max):
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "field": "prompt_text"},
            )

        turn_cap = await _effective_turn_cap(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri, override=None
        )

        prompt = await prompts_store.insert(
            conn,
            tenant_id=principal.tenant_id,
            project_iri=project_iri,
            principal_iri=principal.principal_iri,
            prompt_text=text,
        )
        run_id = str(uuid.uuid4())
        # AC-1: the linkage (`should persist prompt row linked to run id`)
        # is committed synchronously here -- the dispatch loop itself runs
        # afterwards, in the background task below.
        await prompts_store.set_run_id(
            conn, tenant_id=principal.tenant_id, prompt_id=prompt.prompt_id, run_id=run_id
        )

    background_tasks.add_task(
        _run_prompt_in_background,
        tenant_id=principal.tenant_id,
        project_iri=project_iri,
        run_id=run_id,
        turn_cap=turn_cap,
        prompt_id=prompt.prompt_id,
        prompt_text=text,
    )
    return CreatePromptResponse(run_id=run_id, prompt_id=prompt.prompt_id)

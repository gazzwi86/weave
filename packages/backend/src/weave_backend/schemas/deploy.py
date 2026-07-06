"""Law 13: request schema for `POST
/api/projects/{project_iri}/tasks/{task_id}/deploy` (BE-TASK-009,
build-engine EPIC-008/EPIC-009). The response shape varies by outcome
(committed / skipped / publish_failed / rejected) -- same convention as
`routers/tasks.py`'s gate-failure bodies -- so only the request body is
modelled; the router returns plain dicts for every outcome.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class DeployRequestBody(BaseModel):
    commit_sha: str = Field(min_length=1)
    run_mode: str = Field(min_length=1)


class DemoResponse(BaseModel):
    output_location_ref: str | None
    write_back_complete: bool
    write_back_artefact_iri: str | None

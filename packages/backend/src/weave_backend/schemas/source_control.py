"""Law 13: request/response schemas for `.../source-control` (TASK-023,
E2-S6, FR-061/B9, build-engine EPIC-002).

AC-1 (write-only token, never echoed): `SourceControlPutRequest.token`
deliberately validates only `min_length=1` -- no pattern, no max_length. A
stricter constraint would put the *real* token value into a Pydantic
`ValidationError`'s `input` field on the one failure mode
(`Field(min_length=1)`'s only failure is an empty string, which is
harmless to surface). `SourceControlResponse` has no token field at all --
the value is structurally unreturnable, not merely omitted by convention.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SourceControlPutRequest(BaseModel):
    provider: Literal["github", "gitlab"]
    token: str = Field(min_length=1)


class SourceControlResponse(BaseModel):
    """AC-1/AC-6: no token field exists on this shape -- there is nothing to
    leak. `configured_by`/`configured_at` come from the audit log (see
    `pm/source_control.py`), not new `projects` columns.
    """

    provider: Literal["github", "gitlab"]
    token_secret_ref: str
    configured_by: str
    configured_at: str

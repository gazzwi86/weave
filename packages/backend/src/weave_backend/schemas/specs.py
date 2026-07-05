"""Law 13: request/response schemas for `POST /api/specs/{spec_id}/transition`
(BE-TASK-005, build-engine EPIC-006).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

#: Mirrors `build.lifecycle.VALID_TRANSITIONS`' key/value universe -- kept
#: as a literal union here (not imported) so this schema module has no
#: import-time dependency on the domain FSM module (Law 13: reject an
#: unrecognised state at the API boundary before any domain code runs).
SpecState = Literal["Draft", "Spec Review", "Approved", "In Progress", "Complete", "Blocked"]


class SpecTransitionRequest(BaseModel):
    requested_state: SpecState


class SpecTransitionResponse(BaseModel):
    spec_id: str
    status: str

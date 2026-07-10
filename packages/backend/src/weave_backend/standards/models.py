"""TASK-001 (build-engine EPIC-002): the `standards_documents` row shape,
shared by the repo layer (`standards/store.py`), the pure overlay
(`standards/effective.py`), and the generation-context hook
(`standards/generation_hook.py`).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class StandardRecord:
    standard_id: str
    tenant_id: str
    scope: str
    project_id: str | None
    standard_key: str
    title: str
    body_md: str
    stack_pins: dict[str, str] | None
    policy_iri: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime

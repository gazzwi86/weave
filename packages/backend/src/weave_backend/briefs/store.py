"""BE-TASK-002 (build-engine EPIC-005): task-brief persistence.

``task_id`` is deterministic (UUID5 of ``project_iri + task_description``,
Implementation Hints) -- same idempotent-IRI-primary-key pattern as
``projects/model.py``'s ``build_project_iri``, so a retried request
upserts the same row instead of racing a duplicate insert.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

import asyncpg
from pydantic import BaseModel

_TASK_ID_NAMESPACE = uuid.NAMESPACE_URL


class StoredBrief(BaseModel):
    task_id: str
    brief_iri: str
    schema_version: str
    content: dict[str, Any]
    created_at: datetime | None = None


class NewBrief(BaseModel):
    """Grouped input for `insert_task_brief` -- keeps the function under
    Law E's 5-parameter budget (mirrors `projects/model.py`'s `NewProject`).
    """

    tenant_id: str
    task_id: str
    project_iri: str
    brief_iri: str
    schema_version: str
    content: dict[str, Any]


def generate_task_id(project_iri: str, task_description: str) -> str:
    """Deterministic ``task_id`` -- same ``(project_iri, task_description)``
    always yields the same id, so a client retry after a dropped response
    upserts rather than duplicates.
    """
    return str(uuid.uuid5(_TASK_ID_NAMESPACE, f"{project_iri}:{task_description}"))


def build_brief_iri(task_id: str) -> str:
    return f"urn:weave:brief:{task_id}"


async def insert_task_brief(conn: asyncpg.Connection, fields: NewBrief) -> datetime:
    """Upsert the brief document, returning its ``created_at`` (stable
    across retries -- the ``ON CONFLICT`` branch never touches the column).
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        INSERT INTO task_briefs (
            task_id, tenant_id, project_iri, brief_iri, schema_version, content
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (task_id) DO UPDATE SET content = EXCLUDED.content
        RETURNING created_at
        """,
        fields.task_id,
        fields.tenant_id,
        fields.project_iri,
        fields.brief_iri,
        fields.schema_version,
        json.dumps(fields.content),
    )
    return row["created_at"]  # type: ignore[no-any-return]


async def get_task_brief(
    conn: asyncpg.Connection, *, tenant_id: str, task_id: str
) -> StoredBrief | None:
    """Fetch a brief by ``task_id``, scoped to ``tenant_id`` (RLS also
    enforces this at the DB level; the explicit filter is defence-in-depth).
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        "SELECT task_id, brief_iri, schema_version, content, created_at"
        " FROM task_briefs WHERE tenant_id = $1 AND task_id = $2",
        tenant_id,
        task_id,
    )
    if row is None:
        return None
    content = row["content"]
    parsed = json.loads(content) if isinstance(content, str) else content
    return StoredBrief(
        task_id=row["task_id"],
        brief_iri=row["brief_iri"],
        schema_version=row["schema_version"],
        content=parsed,
        created_at=row["created_at"],
    )

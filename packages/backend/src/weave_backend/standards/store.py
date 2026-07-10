"""TASK-001 (build-engine EPIC-002): DB access for `standards_documents`.
Every query is tenant-scoped; RLS (`migrations/0017_standards.sql`) is the
belt-and-braces backstop, same pattern as `notifications/store.py`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import asyncpg

from weave_backend.standards.models import StandardRecord


class ScopeProjectMismatch(Exception):
    """AC-7: `scope='project'` without a `project_id`, or `scope='company'`
    with one.
    """

    def __init__(self, scope: str) -> None:
        self.scope = scope
        super().__init__(f"scope/project_id mismatch for scope={scope!r}")


def validate_scope_project(scope: str, project_id: str | None) -> None:
    """AC-7: pure consistency check -- `scope='project'` requires a
    `project_id`; `scope='company'` forbids one.
    """
    if (scope == "project") != (project_id is not None):
        raise ScopeProjectMismatch(scope)


@dataclass(frozen=True)
class NewStandard:
    """Groups `upsert_standard`'s fields (Law E's 5-parameter budget)."""

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


def _row_to_record(row: asyncpg.Record) -> StandardRecord:
    stack_pins = row["stack_pins"]
    parsed_pins = json.loads(stack_pins) if isinstance(stack_pins, str) else dict(stack_pins)
    return StandardRecord(
        standard_id=str(row["standard_id"]),
        tenant_id=row["tenant_id"],
        scope=row["scope"],
        project_id=row["project_id"],
        standard_key=row["standard_key"],
        title=row["title"],
        body_md=row["body_md"],
        stack_pins=parsed_pins or None,
        policy_iri=row["policy_iri"],
        status=row["status"],
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# Two upsert targets, one per partial unique index (migration comment
# explains why a single plain UNIQUE can't cover both scopes). Both are
# fully literal SQL text (plain strings, no f-string/format interpolation)
# -- every value is a bound positional parameter -- picking between them is
# not a SQL-injection vector.
_UPSERT_COMPANY_SQL = """
    INSERT INTO standards_documents (
        tenant_id, scope, project_id, standard_key,
        title, body_md, stack_pins, policy_iri, status, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
    ON CONFLICT (tenant_id, standard_key) WHERE scope = 'company' AND project_id IS NULL
    DO UPDATE SET title = EXCLUDED.title, body_md = EXCLUDED.body_md,
        stack_pins = EXCLUDED.stack_pins, policy_iri = EXCLUDED.policy_iri,
        status = EXCLUDED.status, updated_at = now()
    RETURNING standard_id, tenant_id, scope, project_id, standard_key,
        title, body_md, stack_pins, policy_iri, status, created_by, created_at, updated_at
"""

_UPSERT_PROJECT_SQL = """
    INSERT INTO standards_documents (
        tenant_id, scope, project_id, standard_key,
        title, body_md, stack_pins, policy_iri, status, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
    ON CONFLICT (tenant_id, project_id, standard_key) WHERE scope = 'project'
    DO UPDATE SET title = EXCLUDED.title, body_md = EXCLUDED.body_md,
        stack_pins = EXCLUDED.stack_pins, policy_iri = EXCLUDED.policy_iri,
        status = EXCLUDED.status, updated_at = now()
    RETURNING standard_id, tenant_id, scope, project_id, standard_key,
        title, body_md, stack_pins, policy_iri, status, created_by, created_at, updated_at
"""


async def upsert_standard(conn: asyncpg.Connection, fields: NewStandard) -> StandardRecord:
    """AC-1..AC-7: insert or (whole-row) update one standards document,
    keyed by the partial unique index matching `fields.scope`. Caller
    (`routers/standards.py`) is responsible for AC-1/AC-2's CE-READ-1
    validation and AC-7's `validate_scope_project` *before* calling this --
    this function trusts its input is already valid.
    """
    sql = _UPSERT_COMPANY_SQL if fields.scope == "company" else _UPSERT_PROJECT_SQL
    row = await conn.fetchrow(
        sql,
        fields.tenant_id,
        fields.scope,
        fields.project_id,
        fields.standard_key,
        fields.title,
        fields.body_md,
        json.dumps(fields.stack_pins or {}),
        fields.policy_iri,
        fields.status,
        fields.created_by,
    )
    return _row_to_record(row)


async def list_standards(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    scope: str | None = None,
    project_id: str | None = None,
    status: str | None = None,
) -> list[StandardRecord]:
    """Lists `standards_documents` rows for `tenant_id`, optionally filtered
    by `scope`/`project_id`/`status`. `tenant_id` is always bound
    explicitly (defence in depth on top of RLS, same precedent as
    `projects/model.py.get_project`).
    """
    clauses = ["tenant_id = $1"]
    params: list[object] = [tenant_id]
    if scope is not None:
        params.append(scope)
        clauses.append(f"scope = ${len(params)}")
    if project_id is not None:
        params.append(project_id)
        clauses.append(f"project_id = ${len(params)}")
    if status is not None:
        params.append(status)
        clauses.append(f"status = ${len(params)}")
    where = " AND ".join(clauses)
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    # `where` is assembled only from fixed literal fragments ("tenant_id =
    # $N" etc); every value is still a bound positional parameter, never
    # string-interpolated -- ruff's S608 false positive suppressed inline
    # below (RUF100 requires the noqa live on the flagged line itself).
    rows = await conn.fetch(
        f"SELECT standard_id, tenant_id, scope, project_id, standard_key,"  # noqa: S608  # nosec B608
        f" title, body_md, stack_pins, policy_iri, status, created_by, created_at, updated_at"
        f" FROM standards_documents WHERE {where} ORDER BY standard_key",
        *params,
    )
    return [_row_to_record(row) for row in rows]


async def load_effective_standards(
    conn: asyncpg.Connection, *, tenant_id: str, project_id: str
) -> tuple[list[StandardRecord], list[StandardRecord]]:
    """Fetches the two `active`-status lists AC-3's `effective_set`
    overlays -- kept separate from `effective_set` itself so that function
    stays a pure, DB-free free function (implementation hint).
    """
    company = await list_standards(conn, tenant_id=tenant_id, scope="company", status="active")
    project = await list_standards(
        conn, tenant_id=tenant_id, scope="project", project_id=project_id, status="active"
    )
    return company, project

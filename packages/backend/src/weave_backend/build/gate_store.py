"""BE-TASK-007 (build-engine EPIC-012): `gate_results` persistence
(migration 0013, ADR-004). One table serves DoR/DoD/pre-scaffold's
differently-shaped results -- `payload` carries the gate-specific variable
part (`failing_checks` | `commands` | `findings`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import asyncpg


@dataclass(frozen=True)
class NewGateResult:
    """Grouped input for `insert_gate_result` (Law E 5-parameter budget --
    same grouping precedent as `briefs.store.NewBrief`).
    """

    tenant_id: str
    gate: str
    result: str
    payload: dict[str, Any] = field(default_factory=dict)
    task_id: str | None = None
    project_iri: str | None = None
    run_id: str | None = None


async def insert_gate_result(conn: asyncpg.Connection, fields: NewGateResult) -> None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        """
        INSERT INTO gate_results (tenant_id, gate, result, task_id, project_iri, run_id, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        """,
        fields.tenant_id,
        fields.gate,
        fields.result,
        fields.task_id,
        fields.project_iri,
        fields.run_id,
        json.dumps(fields.payload),
    )

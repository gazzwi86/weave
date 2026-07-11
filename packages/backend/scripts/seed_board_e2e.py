"""E2E-only seeding helper for BE-V1-TASK-017's board Playwright spec.

Commits a `StateSpine` directly (no dark-factory run, no agent calls -- Law F)
so the E2E spec has real board/task-tree data to assert against. Mirrors
`tests/integration/test_board_api.py::_seed_spine`.

Usage: uv run python scripts/seed_board_e2e.py <tenant_id> <project_iri>
"""

from __future__ import annotations

import asyncio
import sys

from weave_backend.build.state_spine import StateSpine, TaskState, commit_state_spine
from weave_backend.db.pool import tenant_connection


async def seed(tenant_id: str, project_iri: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        spine = StateSpine(
            project_iri=project_iri,
            tenant_id=tenant_id,
            run_id="run-e2e",
            phase="halted_hitl",
            dispatch_count=3,
            turn_cap=60,
            tasks=[
                TaskState(id="t-1", status="Done"),
                TaskState(id="t-2", status="Blocked"),
                TaskState(id="t-3", status="Ready", blocked_by=["t-missing"]),
            ],
        )
        await commit_state_spine(conn, spine)


if __name__ == "__main__":
    asyncio.run(seed(sys.argv[1], sys.argv[2]))

"""CE-TASK-006 report builder for `GET /api/validate`. Wraps the SAME
validator config TASK-005's commit-gate uses (`shacl.validate_graph_for_tenant`,
`inference='none'`) -- never a second validator config (implementation
hint: drift between commit-gate and report is an audit bug).

Cache-check-then-compute orchestration lives in `routers/validate.py`
(mirrors `routers/metrics.py`'s route-handler shape), not here -- keeps
each function under the 5-param complexity budget.
"""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

import asyncpg
from rdflib import Graph

from weave_backend.operations import shacl, versioning
from weave_backend.operations.shacl import RedisLike
from weave_backend.schemas.validate import (
    RuleCoverage,
    ValidationReport,
    ValidationResultEntry,
)
from weave_backend.tenancy.workspaces import Workspace


async def resolve_graph(
    conn: asyncpg.Connection, *, tenant_id: str, workspace: Workspace, version: str
) -> tuple[str, str]:
    """Returns `(graph_iri, data_stamp)`. `draft` reads the workspace's
    live named graph, stamped with `head_version_iri` (the newest minted
    version row -- changes iff the draft moved). `latest`/an explicit
    version_iri read that version's own immutable snapshot graph
    (`pipeline._commit` loads every minted version as its own named
    graph), stamped with itself -- no DB round trip needed to detect
    staleness on an immutable version. Raises `VersionNotFound` (-> 404)
    for an unknown explicit version_iri.
    """
    if version == "draft":
        head = await versioning.head_version_iri(
            conn, tenant_id=tenant_id, workspace_id=workspace.id
        )
        return workspace.named_graph_iri, head or "unversioned"

    resolved_iri = await versioning.resolve_version(
        conn, tenant_id=tenant_id, workspace_id=workspace.id, version=version
    )
    known = await versioning.get_version(conn, tenant_id=tenant_id, version_iri=resolved_iri)
    if known is None:
        raise versioning.VersionNotFound(resolved_iri)
    return resolved_iri, resolved_iri


def compose_state_stamp(data_stamp: str, shapes_token: str | None) -> str:
    """AC-006-04: the report is stamped with the shapes+data state it ran
    against -- either half moving changes the stamp, so a stale report
    (of either kind) misses cache instead of being served."""
    return f"{data_stamp}:{shapes_token or 'framework'}"


async def build_report(
    data_graph: Graph, *, tenant_id: str, redis_client: RedisLike | None, version_resolved: str
) -> ValidationReport:
    """AC-006-01/-03: full SHACL report incl. `sh:Info`, grouped by shape
    with a violation count per rule -- zero-violation shapes included."""
    shapes = await shacl.tenant_shapes_for_validation(tenant_id, redis_client)
    results = shacl.validate_graph_with_shapes(data_graph, shapes)
    counts = Counter(result.shape_iri for result in results)
    rules = [
        RuleCoverage(
            shape_iri=rule.shape_iri,
            severity=rule.severity,  # type: ignore[arg-type]
            description=rule.description,
            origin=rule.origin,  # type: ignore[arg-type]
            violation_count=counts.get(rule.shape_iri, 0),
            target_class=rule.target_class,
            constraint_summary=rule.constraint_summary,
        )
        for rule in shacl.list_rules(shapes, tenant_id=tenant_id)
    ]
    return ValidationReport(
        results=[
            ValidationResultEntry(
                shape_iri=result.shape_iri,
                focus_node=result.focus_node,
                path=result.path,
                message=result.message,
                severity=result.severity,  # type: ignore[arg-type]
            )
            for result in results
        ],
        rules=rules,
        ran_at=datetime.now(UTC),
        version_resolved=version_resolved,
    )

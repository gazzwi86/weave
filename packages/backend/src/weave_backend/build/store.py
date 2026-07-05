"""In-memory, process-local spec/task store (ADR-001, build-engine
decisions). M1 has no `specs`/`tasks` Aurora tables yet -- the task brief
explicitly says a migration should not be needed, and every specified unit
test scenario is DB-free by design. Keyed by `(tenant_id, id)` so a
cross-tenant lookup always misses, mirroring what a `WHERE tenant_id = ...`
filter gives at the DB layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field


class SpecNotFound(Exception):
    """Raised when no spec row matches the given (tenant_id, spec_id)."""


class TaskNotFound(Exception):
    """Raised when no task row matches the given (tenant_id, task_id)."""


@dataclass
class SpecRecord:
    tenant_id: str
    spec_id: str
    status: str


@dataclass
class TaskRecord:
    tenant_id: str
    task_id: str
    status: str = "Queued"
    project_iri: str | None = None
    run_mode: str = "normal"
    retry_counts: dict[str, int] = field(default_factory=dict)
    last_agent_principal_iri: str | None = None
    blocked_reason: str | None = None


_specs: dict[tuple[str, str], SpecRecord] = {}
_tasks: dict[tuple[str, str], TaskRecord] = {}


def reset_for_tests() -> None:
    """Test-only: clears both stores between tests (autouse fixture)."""
    _specs.clear()
    _tasks.clear()


def spec_iri(tenant_id: str, spec_id: str) -> str:
    return f"urn:weave:spec:{tenant_id}:{spec_id}"


def task_iri(tenant_id: str, task_id: str) -> str:
    return f"urn:weave:task:{tenant_id}:{task_id}"


def create_spec(tenant_id: str, spec_id: str, *, status: str = "Draft") -> SpecRecord:
    record = SpecRecord(tenant_id=tenant_id, spec_id=spec_id, status=status)
    _specs[(tenant_id, spec_id)] = record
    return record


def get_spec(tenant_id: str, spec_id: str) -> SpecRecord | None:
    return _specs.get((tenant_id, spec_id))


def update_spec_status(tenant_id: str, spec_id: str, status: str) -> SpecRecord:
    record = _specs.get((tenant_id, spec_id))
    if record is None:
        raise SpecNotFound(spec_id)
    record.status = status
    return record


def create_task(
    tenant_id: str,
    task_id: str,
    *,
    project_iri: str | None = None,
    status: str = "Queued",
    run_mode: str = "normal",
) -> TaskRecord:
    record = TaskRecord(
        tenant_id=tenant_id,
        task_id=task_id,
        status=status,
        project_iri=project_iri,
        run_mode=run_mode,
    )
    _tasks[(tenant_id, task_id)] = record
    return record


def get_task(tenant_id: str, task_id: str) -> TaskRecord | None:
    return _tasks.get((tenant_id, task_id))


def _require_task(tenant_id: str, task_id: str) -> TaskRecord:
    record = _tasks.get((tenant_id, task_id))
    if record is None:
        raise TaskNotFound(task_id)
    return record


def update_task_status(
    tenant_id: str, task_id: str, status: str, *, blocked_reason: str | None = None
) -> TaskRecord:
    record = _require_task(tenant_id, task_id)
    record.status = status
    record.blocked_reason = blocked_reason
    return record


def set_last_agent_principal(tenant_id: str, task_id: str, principal_iri: str) -> TaskRecord:
    record = _require_task(tenant_id, task_id)
    record.last_agent_principal_iri = principal_iri
    return record


def increment_retry(tenant_id: str, task_id: str, failure_class: str) -> int:
    record = _require_task(tenant_id, task_id)
    record.retry_counts[failure_class] = record.retry_counts.get(failure_class, 0) + 1
    return record.retry_counts[failure_class]

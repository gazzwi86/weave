"""In-memory, process-local spec/task store (ADR-002, build-engine
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


@dataclass
class ProjectSpecRecord:
    """BE-TASK-007: cascade-presence flags the pre-scaffold gate checks
    (brief -> PRD -> roadmap -> tech-spec -> impl-ready). Same ADR-002
    in-memory, process-local pattern as `SpecRecord`/`TaskRecord` -- no
    Aurora table for this exists anywhere in the codebase, and this task's
    pre-scaffold gate is an M1 pass-through stub, not durable project-spec
    storage. `impl_ready_flag` is never auto-computed (Implementation
    Hints) -- only `upsert_project_spec` sets it, explicitly.
    """

    tenant_id: str
    project_iri: str
    brief_present: bool = False
    prd_present: bool = False
    roadmap_present: bool = False
    tech_spec_present: bool = False
    impl_ready_flag: bool = False


_specs: dict[tuple[str, str], SpecRecord] = {}
_tasks: dict[tuple[str, str], TaskRecord] = {}
_project_specs: dict[tuple[str, str], ProjectSpecRecord] = {}


def reset_for_tests() -> None:
    """Test-only: clears both stores between tests (autouse fixture)."""
    _specs.clear()
    _tasks.clear()
    _project_specs.clear()


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


def get_project_spec(tenant_id: str, project_iri: str) -> ProjectSpecRecord:
    """Never `None` -- a project with no recorded spec state is exactly
    "nothing present yet" (every cascade step False), which is itself a
    valid pre-scaffold finding, not a lookup failure.
    """
    return _project_specs.get(
        (tenant_id, project_iri), ProjectSpecRecord(tenant_id=tenant_id, project_iri=project_iri)
    )


def upsert_project_spec(tenant_id: str, project_iri: str, **flags: bool) -> ProjectSpecRecord:
    """Test/tech-spec-author seeding helper -- `flags` are any subset of
    `ProjectSpecRecord`'s cascade-presence fields.
    """
    record = _project_specs.get(
        (tenant_id, project_iri), ProjectSpecRecord(tenant_id=tenant_id, project_iri=project_iri)
    )
    for key, value in flags.items():
        setattr(record, key, value)
    _project_specs[(tenant_id, project_iri)] = record
    return record

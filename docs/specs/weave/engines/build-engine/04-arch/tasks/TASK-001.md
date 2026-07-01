---
type: Task
title: "Task: TASK-001 — M1 Project Bootstrap Stub"
description: "Create the minimal backend project record (project_iri + pinned CE version) that lets the dark factory scope its state spine and dep-summary store — no UI."
tags: [build-engine, 04-arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: M1
created: 2026-07-01
blocked_by: []
unlocks: [TASK-004, TASK-006]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/04-arch/tasks/TASK-001.md
---

# Task: TASK-001 — M1 Project Bootstrap Stub

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002--project-registry--settings)
**Status:** Backlog
**Priority:** Must Have

**As a** dark-factory orchestrator
**I want** a minimal backend project record (project IRI + pinned CE version) scoped to my tenant
**So that** the dark factory can reference a stable project context for state spine and dep-summary
scoping before the full Project Registry UI ships in v1.0

> **Context (from build-engine.md §3 EPIC-002 M1 bootstrap note):** The E11 dark factory requires
> a `project_iri` and pinned CE version to scope its RLS state spine. A minimal backend project
> record is an M1 prerequisite; the full Registry grid and governance cascade UI (FR-006 through
> FR-012) land in v1.0. This task delivers only the backend record and its API endpoint.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a valid `POST /api/projects` is received with a Cognito JWT and a `name` field, THE SYSTEM SHALL create a project record with a deterministic `project_iri` (`urn:weave:project:{tenant_id}:{slug}`) and pin the latest published CE version via `CE-VERSION-1`; returning `201` with `{project_iri, pinned_version_iri, created_at}` | `test_create_project_returns_201_with_iri` |
| AC-2 | WHEN `CE-VERSION-1` (`GET /api/ontology/versions`) is unreachable at project creation time, THE SYSTEM SHALL return `503` with `{"error": "ce_version_unavailable"}` and not persist a project record | `test_create_project_fails_503_when_ce_unreachable` |
| AC-3 | WHEN an unauthenticated request reaches `POST /api/projects`, THE SYSTEM SHALL return `401` with `{"error": "unauthorised"}` and the `Www-Authenticate: Bearer` header | `test_create_project_returns_401_without_jwt` |
| AC-4 | WHEN a tenant-B principal queries `GET /api/projects/{project_iri}`, THE SYSTEM SHALL return `404` for a project owned by tenant-A (RLS enforced at DB level) | `test_project_rlsi_tenant_b_cannot_read_tenant_a` |
| AC-5 | WHEN a project with the same name already exists in the same tenant, THE SYSTEM SHALL return `409` with `{"error": "project_exists", "existing_iri": "<iri>"}` | `test_create_project_409_on_duplicate_name` |
| AC-6 | WHEN `name` is absent or empty in the request body, THE SYSTEM SHALL return `422` with `{"error": "validation_error", "field": "name"}` | `test_create_project_422_missing_name` |

## Implementation

### Pseudocode

```
function create_project(jwt, name, description=None):
  # Input gates
  claims = cognito.verify(jwt)               # → 401 if absent/invalid
  if not name or not name.strip():
    return 422 with {"error": "validation_error", "field": "name"}

  tenant_id = claims["custom:tenant_id"]
  slug = slugify(name)                       # lowercase, hyphenated, stable
  project_iri = f"urn:weave:project:{tenant_id}:{slug}"

  # Conflict check
  existing = aurora.query(
    "SELECT project_iri FROM projects WHERE tenant_id=:t AND slug=:s",
    t=tenant_id, s=slug
  )
  if existing:
    return 409 with {"error": "project_exists", "existing_iri": existing.project_iri}

  # Pin CE version (must succeed before persisting)
  versions = ce_read_client.get("/api/ontology/versions")  # raises on non-2xx → 503
  latest = next(v for v in versions if v["is_latest"])
  pinned_version_iri = latest["version_iri"]

  # Persist
  aurora.execute(
    "INSERT INTO projects (project_iri, tenant_id, slug, name, description, pinned_version_iri, created_at)"
    " VALUES (:iri, :t, :s, :n, :d, :v, now())",
    iri=project_iri, t=tenant_id, s=slug, n=name, d=description, v=pinned_version_iri
  )  # raises IntegrityError on race-condition duplicate → retry as 409

  return 201 with {"project_iri": project_iri, "pinned_version_iri": pinned_version_iri,
                   "created_at": "<iso8601>"}
```

### API Contracts

**`POST /api/projects`**

Request body:

```json
{
  "name": "string — project display name, 1–120 chars (required)",
  "description": "string | null — optional free-text description (optional)"
}
```

Response `201`:

```json
{
  "project_iri": "string — stable urn:weave:project:{tenant}:{slug}",
  "pinned_version_iri": "string — IRI of the pinned CE version (from CE-VERSION-1)",
  "created_at": "string — ISO 8601 UTC timestamp"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid Cognito JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 409 | Project name already exists for this tenant | `{"error": "project_exists", "existing_iri": "<iri>"}` |
| 422 | `name` absent or empty | `{"error": "validation_error", "field": "name"}` |
| 503 | `CE-VERSION-1` unreachable | `{"error": "ce_version_unavailable"}` |

**`GET /api/projects/{project_iri}`**

Response `200`:

```json
{
  "project_iri": "string",
  "name": "string",
  "pinned_version_iri": "string",
  "created_at": "string"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` |
| 404 | Project not found or belongs to another tenant (RLS) | `{"error": "not_found"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Data Model | `../tech-spec/data-model.md` | `#projects-table` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |
| Sequence | `../tech-spec/business-process.md` | `#project-create-flow` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |
| State | N/A | N/A | N/A — TASK-001 creates a record; no lifecycle state machine here (lifecycle is TASK-005) |

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| Backend: Python 3.12 + FastAPI + Pydantic v2 + `uv` | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | FastAPI route handler; Pydantic model for request/response validation |
| Auth: AWS Cognito JWT | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | `python-jose` for JWT verification; `custom:tenant_id` claim scopes RLS |
| Relational store: Aurora PostgreSQL Serverless v2 + SQLAlchemy async | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | Async `session.execute` for project insert; RLS enforced at DB constraint level |
| Secrets: AWS Secrets Manager only | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | DB credentials and CE client credentials retrieved from Secrets Manager; not hardcoded |
| CE-VERSION-1 contract (pin latest on create) | [contracts.md `CE-VERSION-1`](../../../../contracts.md#ce-version-1) | Must call `GET /api/ontology/versions` and pick `is_latest`; failure = 503, no fallback |
| Project IRI scheme: `urn:weave:project:{tenant_id}:{slug}` | No ADR yet — first decision made in this task | Deterministic, tenant-scoped, collision-safe; slug = slugified name; any change requires migration |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 401 when JWT is absent`
- `should return 401 when JWT is expired or invalid`
- `should return 422 when name is absent`
- `should return 422 when name is empty string`
- `should return 409 when project with same slug already exists for tenant`
- `should build correct project_iri from tenant_id and slugified name`
- `should return 503 when CE-VERSION-1 raises connection error`

### Integration Tests (minimum 3)

- `should persist project record to Aurora and return it via GET /api/projects/{iri}`
- `should reject unauthenticated POST /api/projects with 401`
- `should return 404 for tenant-B principal querying tenant-A project (RLS)`
- `should pin the latest published CE version from CE-VERSION-1 on create`

### E2E Tests

N/A — no UI surface; covered by integration tests. TASK-001 is a backend-only stub.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Integration | `should persist project record to Aurora and return it via GET /api/projects/{iri}` |
| AC-2 | Unit | `should return 503 when CE-VERSION-1 raises connection error` |
| AC-3 | Unit | `should return 401 when JWT is absent` |
| AC-4 | Integration | `should return 404 for tenant-B principal querying tenant-A project (RLS)` |
| AC-5 | Unit | `should return 409 when project with same slug already exists for tenant` |
| AC-6 | Unit | `should return 422 when name is absent` |

## Dependencies

- **blocked_by:** [] — depends only on platform services being provisioned (Cognito, Aurora, CE-VERSION-1 endpoint)
- **unlocks:** [TASK-004, TASK-006]
- **External prerequisites:** `"AWS Cognito user pool provisioned in staging"`, `"Aurora PostgreSQL instance and schema migration run"`, `"CE-VERSION-1 endpoint available in staging"`

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~8k input, ~4k output
- **Estimated cost:** ~$0.40 (claude-opus-4-8 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included (2 pending — flagged as DoR blockers for tech-spec pass)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided
- [ ] Tech-spec data model and sequence diagrams created (DoR blocker — must resolve before implementation)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-002

## Implementation Hints

- `python-jose` for Cognito JWT verification is the standard in this stack; the `tenant_id` is
  in the `custom:tenant_id` claim — do not use `sub` as the tenant discriminator.
- Use `python-slugify` (`pip install python-slugify`) for deterministic IRI slug generation;
  the same library must be used wherever slugs are regenerated to avoid IRI drift.
- The Aurora integration test fixture (`tests/conftest.py`) should spin up a PostgreSQL container
  (testcontainers-python) — do not use LocalStack for the DB; Aurora-compatible Postgres is enough.
- CE-VERSION-1 client calls should be wrapped in a circuit breaker (tenacity retry × 2, then
  raise) so the 503 path is exercised reliably in unit tests via `unittest.mock.patch`.
- The RLS predicate must be enforced at the DB level (`ALTER TABLE projects ENABLE ROW LEVEL
  SECURITY; CREATE POLICY tenant_isolation ON projects USING (tenant_id = current_setting(...))`),
  not just in application logic — the integration test must verify this by connecting as a
  different DB role.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

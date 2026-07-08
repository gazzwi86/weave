---
type: Task
title: "Task: TASK-005 — BE-SDK-1 Trigger API, breaking:true Ack Flow, Provenance + Regeneration (E8-S5, FR-059)"
description: "Wrap the TASK-004 pipeline in the delivery machinery: trigger/status API,
  CE-DIFF-1 breaking-span check with HITL refusal + persisted ack (sdk_breaking_ack), BE-ARTEFACT-1
  provenance stamping, versioning {ce_version}+build.{n}, atomic ScmDriver commit, projects
  bookkeeping columns."
tags: [build-engine, arch, task, m2]
status: Backlog
priority: Should Have
entity: build-engine
epic: EPIC-008
milestone: M2
created: 2026-07-08
blocked_by: [TASK-004, TASK-001]
unlocks: []
adr_refs: [ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m2/tasks/TASK-005.md
---

# Task: TASK-005 — BE-SDK-1 Trigger API, breaking:true Ack Flow, Provenance + Regeneration (E8-S5, FR-059)

## Story

**Epic:** [EPIC-008 — App Generation](../../../build-engine.md#epic-008)
**Status:** Backlog · **Priority:** Should Have

**As a** project owner
**I want** to trigger SDK (re)generation, be refused when the ontology changed breakingly until
a human acknowledges, and get a versioned, provenance-stamped package in my repo
**So that** my client-owned SDK never silently breaks under me — and every package answers
"generated from which graph version, by whom, acknowledged by whom"

> **FRs covered:** FR-059 delivery half (trigger, versioning, provenance, breaking-ack,
> regeneration on CE-DIFF-1 delta). Pipeline internals are TASK-004. Together they close **M2
> exit criterion 2**.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `POST /api/projects/{id}/sdk-generations` is called, THE SYSTEM SHALL enqueue a generation against the project's pinned CE version and return `202 {generation_id, status:"queued"}` | `should enqueue generation and return 202` |
| AC-2 | WHEN the CE-DIFF-1 response's ordered `versions[]` span between `projects.last_sdk_version_iri` and the requested pin contains any `breaking: true` entry (`any(versions[].breaking)` — CE computes `breaking` at publish, covering BOTH function-signature AND shape/kind surface changes), THE SYSTEM SHALL halt before the pipeline runs and fire the existing HITL gate naming the breaking version IRIs; Build SHALL NOT re-derive breakingness from the diff's triples or the function list | `should refuse sdk regeneration across breaking version without ack` |
| AC-3 | WHEN a human approver (non-self, D9) acknowledges, THE SYSTEM SHALL persist a `gate_results` row `gate: "sdk_breaking_ack"` with approver principal IRI + acked version IRIs, then run the pipeline | `should persist ack row and proceed after approval` |
| AC-4 | WHEN generation is a project's first (no `last_sdk_version_iri`), THE SYSTEM SHALL skip the breaking check entirely | `should skip breaking check on first generation` |
| AC-5 | WHEN the pipeline succeeds, THE SYSTEM SHALL stamp every generated file with the BE-ARTEFACT-1 provenance header (spec ID, pinned CE version, referenced entity IRIs), set package version `{ce_version_tag}+build.{n}`, commit via one `ScmDriver.commit_workspace`, and update `projects.last_sdk_version_iri` + increment `sdk_generation_count` in the same transaction | `should stamp provenance and commit atomically` |
| AC-6 | WHEN the pipeline or commit fails at any point, THE SYSTEM SHALL leave the repo and the projects columns unchanged and record the generation `failed` with the named cause | `should leave repo and bookkeeping unchanged on failure` |
| AC-7 | WHEN `GET /api/projects/{id}/sdk-generations/latest` is called, THE SYSTEM SHALL return the newest generation record `{generation_id, status, package_version?, breaking_hold?}` | `should return latest generation status` |
| AC-8 | WHEN a tenant-B principal triggers or reads generations for a tenant-A project, THE SYSTEM SHALL return 404 (RLS — the project does not exist for them) | `should return 404 cross-tenant` |

## Implementation

### Pseudocode

```
function trigger_generation(jwt, project_id):
  claims = cognito.verify(jwt)                                   # → 401
  project = repo.projects.get(project_id, tenant=claims.tenant_id)   # → 404 (AC-8, RLS)
  gen = repo.sdk_generations.insert(project, status="queued")    # reuse generation_runs table,
  enqueue(run_generation, gen.id)                                # run_kind="sdk"
  return 202 {generation_id: gen.id, status: "queued"}

function run_generation(gen_id):
  gen, project = load(gen_id)
  pin = project.pinned_graph_version_iri

  if project.last_sdk_version_iri:                               # AC-4
    span = ce_client.diff(from=project.last_sdk_version_iri, to=pin)   # CE-DIFF-1
    breaking = [v for v in span.versions if v.breaking]          # CE's flag is the ONLY signal —
    # never inspect span.added/removed/modified or /api/functions to decide breakingness (AC-2)
    if breaking:
      update(gen, status="breaking_hold")
      fire_hitl_gate("sdk_breaking_ack", versions=breaking)      # M1 gate machinery — AC-2
      return                                                     # resumes via on_ack

  staging = generate_sdk(pin)                                    # TASK-004 pipeline
  stamp_provenance(staging, spec_id=project.spec_id, pin=pin,
                   entity_iris=collect_iris(staging))            # AC-5
  version = f"{pin.tag}+build.{project.sdk_generation_count + 1}"
  with repo.tx():                                                # AC-5/AC-6 — one transaction
    scm_driver.commit_workspace(project.repo, staging,
                                message=f"chore(sdk): {version}")
    repo.projects.update(project, last_sdk_version_iri=pin,
                         sdk_generation_count=+1)
    update(gen, status="passed", package_version=version)

function on_ack(gate_row):                                       # AC-3 — HITL callback
  assert gate_row.approver != gate_row.requester                 # D9 (gate machinery enforces)
  record_gate(gate_row.run, "sdk_breaking_ack", "passed",
              {approver: gate_row.approver_iri, acked: gate_row.version_iris})
  resume run_generation(gate_row.run.gen_id) past the breaking check
```

### API Contracts

**`POST /api/projects/{id}/sdk-generations`** — p95 ≤ 500 ms (enqueue only)

Response `202`: `{"generation_id": "uuid", "status": "queued"}`. Errors:

| Status | Condition |
|---|---|
| 401 | Missing/invalid JWT |
| 403 | Principal lacks project role |
| 404 | Project not found (incl. cross-tenant — AC-8) |
| 409 | A generation for this project is already `queued|running|breaking_hold` |
| 422 | Project has no pinned CE version |
| 500 | Unexpected |

**`GET /api/projects/{id}/sdk-generations/latest`** — p95 ≤ 300 ms

Response `200`: `{"generation_id", "status": "queued|running|breaking_hold|passed|failed",
"package_version"?, "breaking_hold": {"version_iris": []}?, "failure_cause"?}`.
Errors: 401/403/404/500.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Component | `../../tech-spec/m2-delta.md` | §2 diagram | SDK Generator → ScmDriver; HITL reuse |
| Decision | `../../decisions/ADR-006.md` | §4–5 | Versioning, provenance, breaking-refusal semantics |
| Data model | `../../tech-spec/m2-delta.md` | §4 | `projects` columns + `sdk_breaking_ack` gate kind |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Reuse M1 HITL gate machinery for the ack | [ADR-006](../../decisions/ADR-006.md) §5 | No new approval UI/flow; D9 no-self-approval and fail-closed come free |
| Ack persisted as `gate_results` row | m2-delta §4 | `gate: "sdk_breaking_ack"`; no new table |
| Reuse `generation_runs` with `run_kind="sdk"` | data-model.md §Generation Runs | No new runs table; status enum reused (`breaking_hold` maps to `hitl_escalated` family) |
| Bookkeeping update + commit in one transaction | [ADR-006](../../decisions/ADR-006.md) §3 | Crash between commit and bookkeeping cannot desync `last_sdk_version_iri` |
| Prior packages live in git history | [ADR-006](../../decisions/ADR-006.md) §4 | No package archive store; client pins by ref |

## Test Requirements

### Unit Tests (minimum 4)

- `should skip breaking check on first generation`
- `should compute package version from generation count`
- `should return 409 when generation already in flight`
- `should return 422 when project has no pinned version`

### Integration Tests (minimum 5)

- `should enqueue generation and return 202`
- `should refuse sdk regeneration across breaking version without ack` (CE-DIFF-1 stub with breaking span)
- `should persist ack row and proceed after approval` (HITL stub approves as different principal)
- `should stamp provenance and commit atomically` (SCM stub asserts single commit + header present)
- `should leave repo and bookkeeping unchanged on failure` (pipeline poisoned; assert no commit, columns unchanged)
- `should return 404 cross-tenant` (two-tenant fixture)

### E2E Tests

N/A UI. The exit-criterion proof is the integration lane: fixture graph → generated package →
tsc/mypy pass (TASK-004) → committed to SCM stub with provenance (this task).

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should enqueue generation and return 202` |
| AC-2 | Integration | `should refuse sdk regeneration across breaking version without ack` |
| AC-3 | Integration | `should persist ack row and proceed after approval` |
| AC-4 | Unit | `should skip breaking check on first generation` |
| AC-5 | Integration | `should stamp provenance and commit atomically` |
| AC-6 | Integration | `should leave repo and bookkeeping unchanged on failure` |
| AC-7 | Integration | `should return latest generation status` (add to list — trivial read) |
| AC-8 | Integration | `should return 404 cross-tenant` |

## Dependencies

- **blocked_by:** [TASK-004] (pipeline), [TASK-001] (owns the m2-delta §4 migration carrying
  `projects.last_sdk_version_iri` + `sdk_generation_count` — this task creates NO migration)
- **unlocks:** []
- **External prerequisites:** CE-DIFF-1 with the `versions[]` breaking-span (live); M1 HITL
  gate machinery + ScmDriver

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~16k input, ~7k output
- **Estimated cost:** ~$0.55 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (status codes + p95)
- [x] Diagram references included
- [x] Design decisions noted (ADR-006)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (TASK-004 pipeline + TASK-001 migration)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `sdk_breaking_ack` greppable (invariants.md verify-by); single `commit_workspace` call site
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-008

## Implementation Hints

- The HITL resume path already exists for cap-halt/gate-fail (M1 TASK-006) — `breaking_hold` is
  a new hold reason on that machinery, not a new state machine.
- `collect_iris(staging)`: the TASK-004 IR already knows every referenced entity IRI — pass the
  IR through rather than re-scanning emitted files.
- Provenance header format: reuse the BE-ARTEFACT-1 header emitted by the M1 write-back
  coordinator (TASK-009 M1) — same fields, same comment syntax per language.
- 409 in-flight check is a `SELECT ... FOR UPDATE` on the newest generation row, not an advisory
  flag — two concurrent triggers must serialise.
- `{ce_version_tag}+build.{n}` uses `+` build metadata (semver §10) so npm/pip treat regens of
  the same CE version as the same release line — do not use a pre-release `-` separator.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

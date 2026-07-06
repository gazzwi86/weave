---
type: Task
title: "Task: TASK-009 — Deploy/Demo & Graph Write-Back (E8-S4 + E9-S1)"
description: "Publish the generated app bundle to S3 and write BE-ARTEFACT-1 provenance headers back to the Constitution graph via CE-WRITE-1 (lean M1 scope — no live preview / feature-flag rollback)."
tags: [build-engine, arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-008
milestone: M1
created: 2026-07-01
blocked_by: [TASK-007, TASK-008]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m1/tasks/TASK-009.md
---

# Task: TASK-009 — Deploy/Demo & Graph Write-Back (E8-S4 + E9-S1)

## Story

**Epic:** [EPIC-008 — Artefact Generation](../../../build-engine.md#epic-008--artefact-generation)
and [EPIC-009 — Bidirectional Graph Sync & Staleness](../../../build-engine.md#epic-009--bidirectional-graph-sync--staleness)
**Status:** Backlog
**Priority:** Must Have

**As a** product owner
**I want** the generated application bundle published to durable storage (S3) and the generated
entities written back to the Constitution graph with provenance
**So that** the artefact is retrievable and the Constitution graph reflects what was built

> **FRs covered (lean M1 scope):** FR-033 (publish artefact bundle to S3 →
> `demo_output_location_ref`) — the live preview environment and time-limited shareable demo URL
> are **deferred to M2** (Law F makes a real Lambda+CloudFront preview synthetic-only, and the M1
> exit criterion in `weave-spec.md §1.3` is `write_back_complete=true` + a resolvable artefact IRI,
> not a served URL). FR-035 (write-back via `CE-WRITE-1` only; SHACL-validated on throwaway clone;
> `BE-ARTEFACT-1` provenance header; **422 → record violations + route to HITL**). The
> feature-flag rollback path is **deferred to M2** with the live preview it protects. Staleness
> (FR-036) is M2. Self-healing (FR-037–FR-040) is post-v1.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a DoD-passing generation commit is available, THE SYSTEM SHALL publish the generated app bundle to S3 and return `{output_location_ref}` — the durable S3 URI (`s3://weave-artefacts/{tenant_id}/{run_id}/`) recorded on `projects.demo_output_location_ref` | `test_publish_returns_output_location_ref` |
| AC-2 | WHEN a publish fails for any reason, THE SYSTEM SHALL retain the prior `output_location_ref` (if one exists), surface the error in `{publish_status: "failed", error: "<message>", prior_output_location_ref: "<uri>|null"}`, and NOT present a false-green readiness status | `test_publish_failure_retains_prior_output_location_ref` |
| AC-3 | WHEN the artefact is successfully published (non-Spike run), THE SYSTEM SHALL write the generated `System`, `Service`, and `DataAsset` nodes to the Constitution graph via `CE-WRITE-1` (`POST /api/operations/apply`) only — every entity carries a `BE-ARTEFACT-1` provenance header `{spec_id, pinned_version_iri, entity_iris}` | `test_write_back_calls_ce_write_1_with_provenance_header` |
| AC-4 | WHEN `CE-WRITE-1` returns `422 { violations: [...] }`, THE SYSTEM SHALL leave `write_back_complete` false, record `write_back_fail_shacl` with the violations in `PLAT-AUDIT-1`, and return `{write_back_status: "rejected", violations: [...]}` routing the task to HITL — no blind retry, no graph mutation committed | `test_write_back_422_records_violations_and_routes_to_hitl` |
| AC-5 | WHEN a write-back completes with `201` from `CE-WRITE-1`, THE SYSTEM SHALL verify zero `sh:Violation` in the SHACL validation (on the throwaway clone) before treating the write as committed; any `sh:Violation` (even advisory) is recorded in `PLAT-AUDIT-1` | `test_write_back_records_shacl_violations_in_audit` |
| AC-6 | WHEN the run mode is `spike`, THE SYSTEM SHALL prevent write-back from calling `CE-WRITE-1` and return `{write_back_status: "skipped", reason: "spike_mode"}` — no graph mutation originates from a spike run | `test_spike_mode_skips_write_back` |
| AC-7 | WHEN write-back completes successfully, THE SYSTEM SHALL emit a `PROV-O activity` to `PLAT-AUDIT-1` attributed to the Build service principal (`PLAT-IDENTITY-1` IRI) with `{activity_iri, applied_count, entity_iris, pinned_version_iri}` and set `projects.write_back_complete=true` with a resolvable `write_back_artefact_iri` (the `weave-spec §1.3` M1 exit criterion) | `test_write_back_success_emits_prov_o_activity_and_marks_complete` |
| AC-8 | WHEN `CE-WRITE-1` is unreachable (`ConnectionError`), THE SYSTEM SHALL leave `write_back_complete` false and return `503 {error: "ce_write_unavailable"}` — the published S3 bundle is retained but unreferenced as committed, so graph and artefact state never silently diverge | `test_write_back_ce_unreachable_returns_503_uncommitted` |

## Implementation

### Pseudocode

```
function publish_and_write_back(jwt, project_iri, task_id, commit_sha, run_mode):
  claims = cognito.verify(jwt)        # → 401
  if run_mode not in ALLOWED_RUN_MODES:   # schemas/requests.ALLOWED_RUN_MODES
    return 422 with {"error": "invalid_run_mode", "allowed": ALLOWED_RUN_MODES}
  project = aurora.get_project(project_iri, tenant=claims.tenant_id)
  if not project: return 404 with {"error": "not_found"}
  # The DoD-passing generation run for this commit (from TASK-008) supplies run_id.
  run = aurora.get_generation_run(commit_sha, tenant=claims.tenant_id)
  if not run: return 404 with {"error": "not_found"}

  # Publish artefact bundle to durable storage (S3). No live preview / feature flag in M1.
  prior_ref = project.demo_output_location_ref
  try:
    output_location_ref = artefact_publisher.publish(commit_sha, claims.tenant_id, run.run_id)
    # artefact_publisher wraps an S3 put -> s3://weave-artefacts/{tenant_id}/{run_id}/ (Law F: mocked)
    aurora.update_project(project_iri, demo_output_location_ref=output_location_ref)
  except PublishError as e:
    return 200 with {"publish_status": "failed", "error": str(e),
                     "prior_output_location_ref": prior_ref}

  # Write-back (skip gracefully if spike mode — return skipped, NOT the 403 that
  # operations.guards.assert_not_spike_write_back raises; that guard is for the mutate path).
  if run_mode == "spike":
    return 201 with {"output_location_ref": output_location_ref,
                     "write_back_status": "skipped", "reason": "spike_mode"}

  # Compose BE-ARTEFACT-1 provenance header
  entity_iris = extract_entity_iris(task)   # System/Service/DataAsset IRIs from generated spec
  provenance_header = {
    "spec_id": task_id,
    "pinned_version_iri": project.pinned_version_iri,
    "entity_iris": entity_iris,
  }

  # SHACL-validate on throwaway clone then write via CE-WRITE-1
  ops = build_graph_operations(entity_iris, provenance_header)
  try:
    ce_write_response = ce_write_client.post("/api/operations/apply", json={
      "operations": ops,
      "actor": BUILD_SERVICE_PRINCIPAL_IRI,  # PLAT-IDENTITY-1
      "target": "draft",
    })
  except ConnectionError:
    # CE-WRITE-1 unreachable. write_back_complete stays false; S3 bundle retained but uncommitted.
    return 503 with {"error": "ce_write_unavailable"}

  if ce_write_response.status_code == 422:
    violations = ce_write_response.json()["violations"]
    emit_audit("write_back_fail_shacl", actor=BUILD_SERVICE_PRINCIPAL_IRI, target=task_id,
               diff_summary={"violations": violations})
    # No rollback: an unreferenced S3 bundle without write_back_complete does not diverge from
    # the graph. Route to HITL; do not retry blindly (tech-spec business-process §deploy flow).
    return 200 with {"write_back_status": "rejected", "violations": violations}

  # 201 success: mark complete, emit PROV-O activity to PLAT-AUDIT-1
  activity = ce_write_response.json()
  artefact_iri = f"urn:weave:artefact:{claims.tenant_id}:{run.run_id}"
  aurora.update_project(project_iri, write_back_complete=True, write_back_artefact_iri=artefact_iri)
  emit_audit("write_back_success", actor=BUILD_SERVICE_PRINCIPAL_IRI, target=task_id,
             diff_summary={
               "activity_iri": activity["activity_iri"],
               "applied_count": activity["applied_count"],
               "entity_iris": entity_iris,
               "pinned_version_iri": project.pinned_version_iri,
             })

  return 201 with {
    "output_location_ref": output_location_ref,
    "write_back_status": "committed",
    "write_back_artefact_iri": artefact_iri,
    "activity_iri": activity["activity_iri"],
    "applied_count": activity["applied_count"],
  }
```

### API Contracts

**`POST /api/projects/{project_iri}/tasks/{task_id}/deploy`**

Request body:

```json
{
  "commit_sha": "string — git commit SHA from TASK-008 generation (required)",
  "run_mode": "string — one of ALLOWED_RUN_MODES (draft_spec_only | spec_to_build | spike); spike skips write-back"
}
```

Response `201` (publish + write-back success):

```json
{
  "output_location_ref": "string — S3 URI of the published artefact bundle",
  "write_back_status": "string — committed | skipped",
  "write_back_artefact_iri": "string | null — resolvable artefact IRI (null if skipped)",
  "activity_iri": "string | null — CE PROV-O activity IRI (null if skipped)",
  "applied_count": "integer | null — nodes/edges applied (null if skipped)"
}
```

Response `200` (publish failed — not 5xx; prior state preserved):

```json
{
  "publish_status": "failed",
  "error": "string — publish error message",
  "prior_output_location_ref": "string | null — prior S3 URI if one existed, else null"
}
```

Response `200` (write-back rejected — SHACL violations, routed to HITL):

```json
{
  "write_back_status": "rejected",
  "violations": [
    {
      "focus_node": "string — IRI of the failing node",
      "path": "string — SHACL property path",
      "severity": "string — Violation | Warning | Info",
      "message": "string — human-readable violation message"
    }
  ]
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Project or task not found | `{"error": "not_found"}` |
| 503 | `CE-WRITE-1` unreachable (write-back left uncommitted) | `{"error": "ce_write_unavailable"}` |

**`GET /api/projects/{project_iri}/demo`**

Response `200`:

```json
{
  "output_location_ref": "string | null — current S3 artefact URI, null if never published",
  "write_back_complete": "boolean — true once CE-WRITE-1 committed the artefact",
  "write_back_artefact_iri": "string | null — resolvable artefact IRI, null if not committed"
}
```

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#deploy-and-write-back-flow` | Publish bundle to S3 → CE-WRITE-1 (BE-ARTEFACT-1) → PROV-O → PLAT-AUDIT-1; 422 → HITL |
| State | `../tech-spec/business-process.md` | `#gate-flow` | Gate-flow diagram (build-engine.md §4) showing WRITEBACK and DoD positions |
| Data Model | `../tech-spec/data-model.md` | `#projects-demo-and-write-back-fields` | `demo_output_location_ref`, `write_back_complete`, `write_back_artefact_iri` columns on `projects` |

All three sections exist in the tech-spec (DoR blockers cleared).

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| CE-WRITE-1 is the ONLY mutation entry point | [contracts.md `CE-WRITE-1`](../../../../contracts.md#ce-write-1) | No direct SPARQL Update or legacy `POST /api/llm/mutate` calls; all mutations via `POST /api/operations/apply` |
| Deploy = publish bundle to S3 (no live preview in M1) | [business-process.md `#deploy-and-write-back-flow`](../../../build-engine/tech-spec/business-process.md#deploy-and-write-back-flow) | `artefact_publisher.publish(...)` wraps an S3 put; live Lambda+CloudFront preview + time-limited demo URL deferred to M2 |
| 422 from CE-WRITE-1 → record + route to HITL | [build-engine.md FR-035](../../../build-engine.md#21-functional-requirements) | No feature-flag rollback (deferred with the live preview); leave `write_back_complete` false, audit the violations, return `rejected` |
| BE-ARTEFACT-1 provenance header on every entity | [contracts.md `BE-ARTEFACT-1`](../../../../contracts.md#be-artefact-1) | `{spec_id, pinned_version_iri, entity_iris}` header included in `CE-WRITE-1` operations payload |
| Spike mode: no write-back, no prod merge | [build-engine.md EPIC-006 decision B4](../../../build-engine.md#key-decisions) | `task.run_mode == "spike"` guard before any `ce_write_client.post(...)` call |
| PROV-O activity attributed to Build service principal | [contracts.md `CE-WRITE-1`](../../../../contracts.md#ce-write-1) + [contracts.md `PLAT-IDENTITY-1`](../../../../contracts.md#plat-identity-1) | `actor` field = `BUILD_SERVICE_PRINCIPAL_IRI` from `PLAT-IDENTITY-1`; not the user's JWT sub |
| CE-WRITE-1 unreachable → leave uncommitted (no divergence) | [business-process.md `#deploy-and-write-back-flow`](../../../build-engine/tech-spec/business-process.md#deploy-and-write-back-flow) | `write_back_complete` stays false; the S3 bundle is inert until committed, so graph and artefact state never silently diverge |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 200 with publish_failed and retain prior_output_location_ref when publish raises PublishError`
- `should skip write-back and return skipped reason when run_mode is spike`
- `should call CE-WRITE-1 with BE-ARTEFACT-1 provenance header fields`
- `should record violations and return rejected without committing when CE-WRITE-1 returns 422`
- `should return 503 and leave write_back_complete false when CE-WRITE-1 raises ConnectionError`
- `should return output_location_ref (S3 URI) on successful publish`

### Integration Tests (minimum 3)

- `should emit PROV-O activity to PLAT-AUDIT-1 and set write_back_complete on successful write-back`
- `should record write_back_fail_shacl audit event on 422 from CE-WRITE-1`
- `should persist demo_output_location_ref and write_back_artefact_iri to Aurora projects table on success`

### E2E Tests

N/A — publish + write-back pipeline is backend-only in M1; covered by integration tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Unit | `should return output_location_ref (S3 URI) on successful publish` |
| AC-2 | Unit | `should return 200 with publish_failed and retain prior_output_location_ref when publish raises PublishError` |
| AC-3 | Unit | `should call CE-WRITE-1 with BE-ARTEFACT-1 provenance header fields` |
| AC-4 | Unit | `should record violations and return rejected without committing when CE-WRITE-1 returns 422` |
| AC-5 | Integration | `should record write_back_fail_shacl audit event on 422 from CE-WRITE-1` |
| AC-6 | Unit | `should skip write-back and return skipped reason when run_mode is spike` |
| AC-7 | Integration | `should emit PROV-O activity to PLAT-AUDIT-1 and set write_back_complete on successful write-back` |
| AC-8 | Unit | `should return 503 and leave write_back_complete false when CE-WRITE-1 raises ConnectionError` |

## Dependencies

- **blocked_by:** [TASK-007, TASK-008]
- **unlocks:** []
- **External prerequisites:** `"CE-WRITE-1 endpoint available in staging"`, `"S3 artefact bucket (weave-artefacts) provisioned — LocalStack under Law F"`, `"PLAT-AUDIT-1 emit endpoint available"`, `"PLAT-IDENTITY-1 service principal IRI for Build service registered"`

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~11k input, ~5k output
- **Estimated cost:** ~$0.60 (claude-fable-5 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included (all 3 exist in the tech-spec)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided
- [x] Tech-spec deploy sequence and write-back flow diagrams created (business-process.md §deploy-and-write-back-flow, §gate-flow; data-model.md §projects-demo-and-write-back-fields)
- [x] Rollback mechanism resolved — deferred to M2 with the live preview; M1 leaves failed write-back uncommitted (no live state to roll back), so no feature-flag service is needed

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-008 / EPIC-009

## Implementation Hints

- **Migration `0016_projects_write_back.sql`** (next free number after `0015_generation_runs.sql`)
  adds three columns to `projects`: `demo_output_location_ref TEXT`, `write_back_complete BOOLEAN
  NOT NULL DEFAULT false`, `write_back_artefact_iri TEXT`. No RLS change — `projects` already has
  its tenant policy from `0009_projects.sql`; `ALTER TABLE` inherits it.
- `run_id` is resolved from the `generation_runs` row for `commit_sha` (see `0015_generation_runs`)
  — it is not a column on any task record. `run_mode` arrives in the request body (there is no
  stored run_mode); validate it against `schemas/requests.ALLOWED_RUN_MODES`.
- `artefact_publisher.publish(commit_sha, tenant_id, run_id)` wraps a single S3 put of the
  generated bundle and returns the `s3://weave-artefacts/{tenant_id}/{run_id}/` URI. Inject it as
  a dependency; under Law F it is mocked in unit tests and hits LocalStack in integration tests —
  never a real AWS account. A `PublishError` surfaces as the AC-2 `publish_failed` 200 body.
- `extract_entity_iris(task)` should parse the tech-spec section of the approved spec for
  mentions of named BPMO kinds (`System`, `Service`, `DataAsset`) and resolve them to IRIs via
  `CE-READ-1` — do not invent IRIs. The 200-node context cap (OQ-11) applies here too.
- The SHACL validation in CE-WRITE-1 runs on a throwaway clone server-side (per the contract);
  the Build service does not need to run SHACL locally. Trust the 422 response body — parse
  `violations` directly from it.
- The `BUILD_SERVICE_PRINCIPAL_IRI` is registered with `PLAT-IDENTITY-1` at service startup
  (not per-request); cache it in a module-level constant populated from the identity service
  on first call, not from an environment variable.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

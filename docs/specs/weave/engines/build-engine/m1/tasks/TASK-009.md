---
type: Task
title: "Task: TASK-009 — Deploy/Demo & Graph Write-Back (E8-S4 + E9-S1)"
description: "Deploy the generated app to a preview environment with a time-limited demo URL, and write BE-ARTEFACT-1 provenance headers back to the Constitution graph via CE-WRITE-1."
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
**I want** the generated application deployed to a preview environment with a shareable demo URL,
and the generated entities written back to the Constitution graph with provenance
**So that** I can verify the artefact works and the Constitution graph reflects what was built

> **FRs covered:** FR-033 (deploy to preview + time-limited demo URL), FR-035 (write-back via
> `CE-WRITE-1` only; SHACL-validated on throwaway clone; `BE-ARTEFACT-1` provenance header;
> 422 → feature-flag rollback). Staleness (FR-036) is M2. Self-healing (FR-037–FR-040) is
> post-v1.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a DoD-passing generation commit is available, THE SYSTEM SHALL deploy the FastAPI backend and Next.js frontend to a preview environment and return `{demo_url, expires_at}` with a time-limited (default 72 h) shareable URL | `test_deploy_returns_demo_url_with_expiry` |
| AC-2 | WHEN a deploy fails for any reason, THE SYSTEM SHALL retain the prior demo URL (if one exists), surface the error in `{deploy_status: "failed", error: "<message>", prior_demo_url: "<url>|null"}`, and NOT present a false-green demo-readiness status | `test_deploy_failure_retains_prior_demo_url` |
| AC-3 | WHEN the artefact is successfully deployed (non-Spike run), THE SYSTEM SHALL write the generated `System`, `Service`, and `DataAsset` nodes to the Constitution graph via `CE-WRITE-1` (`POST /api/operations/apply`) only — every entity carries a `BE-ARTEFACT-1` provenance header `{spec_id, pinned_version_iri, entity_iris}` | `test_write_back_calls_ce_write_1_with_provenance_header` |
| AC-4 | WHEN `CE-WRITE-1` returns `422 { violations: [...] }`, THE SYSTEM SHALL roll back the deployed artefact via its feature flag, surface the violations on the task, and return `{write_back_status: "rolled_back", violations: [...]}` — the graph and deployed state MUST NOT silently diverge | `test_write_back_422_rolls_back_deployment` |
| AC-5 | WHEN a write-back completes with `201` from `CE-WRITE-1`, THE SYSTEM SHALL verify zero `sh:Violation` in the SHACL validation (on the throwaway clone) before treating the write as committed; any `sh:Violation` (even advisory) is recorded in `PLAT-AUDIT-1` | `test_write_back_records_shacl_violations_in_audit` |
| AC-6 | WHEN the run mode is `spike`, THE SYSTEM SHALL prevent write-back from calling `CE-WRITE-1` and return `{write_back_status: "skipped", reason: "spike_mode"}` — no graph mutation originates from a spike run | `test_spike_mode_skips_write_back` |
| AC-7 | WHEN write-back completes successfully, THE SYSTEM SHALL emit a `PROV-O activity` to `PLAT-AUDIT-1` attributed to the Build service principal (`PLAT-IDENTITY-1` IRI) with `{activity_iri, applied_count, entity_iris, pinned_version_iri}` | `test_write_back_success_emits_prov_o_activity_to_audit` |
| AC-8 | WHEN the demo URL is returned, THE SYSTEM SHALL include the `expires_at` ISO 8601 timestamp so consumers can display an accurate expiry; a URL with no expiry MUST NOT be returned | `test_demo_url_includes_expires_at` |

## Implementation

### Pseudocode

```
function deploy_and_write_back(jwt, project_iri, task_id, commit_sha):
  claims = cognito.verify(jwt)        # → 401
  project = aurora.get_project(project_iri, tenant=claims.tenant_id)
  if not project: return 404 with {"error": "not_found"}
  task = aurora.get_task(task_id, tenant=claims.tenant_id)
  if not task: return 404 with {"error": "not_found"}

  # Deploy to preview environment
  prior_demo = aurora.get_prior_demo_url(project_iri)
  try:
    deploy_result = preview_deployer.deploy(commit_sha, project_iri)
    # preview_deployer wraps AWS Lambda + CloudFront + S3 deployment
    expires_at = utcnow() + timedelta(hours=DEMO_URL_TTL_HOURS)  # default 72
    demo_url = deploy_result.url
    aurora.update_project(project_iri, demo_url=demo_url, demo_expires_at=expires_at,
                          deploy_status="success")
  except DeployError as e:
    aurora.update_project(project_iri, deploy_status="failed")
    return 200 with {"deploy_status": "failed", "error": str(e),
                     "prior_demo_url": prior_demo}

  # Write-back (skip if spike mode)
  if task.run_mode == "spike":
    return 201 with {"demo_url": demo_url, "expires_at": expires_at.isoformat(),
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
    # CE-WRITE-1 unreachable; rollback deploy
    preview_deployer.rollback(deploy_result.feature_flag)
    return 503 with {"error": "ce_write_unavailable", "deploy_status": "rolled_back"}

  if ce_write_response.status_code == 422:
    violations = ce_write_response.json()["violations"]
    preview_deployer.rollback(deploy_result.feature_flag)
    emit_audit("write_back_fail_shacl", actor=BUILD_PRINCIPAL, target=task_id,
               diff_summary={"violations": violations})
    return 200 with {"write_back_status": "rolled_back", "violations": violations,
                     "deploy_status": "rolled_back"}

  # 201 success: emit PROV-O activity to PLAT-AUDIT-1
  activity = ce_write_response.json()
  emit_audit("write_back_success", actor=BUILD_SERVICE_PRINCIPAL_IRI, target=task_id,
             diff_summary={
               "activity_iri": activity["activity_iri"],
               "applied_count": activity["applied_count"],
               "entity_iris": entity_iris,
               "pinned_version_iri": project.pinned_version_iri,
             })

  return 201 with {
    "demo_url": demo_url,
    "expires_at": expires_at.isoformat(),
    "write_back_status": "committed",
    "activity_iri": activity["activity_iri"],
    "applied_count": activity["applied_count"],
  }
```

### API Contracts

**`POST /api/projects/{project_iri}/tasks/{task_id}/deploy`**

Request body:

```json
{
  "commit_sha": "string — git commit SHA from TASK-008 generation (required)"
}
```

Response `201` (deploy + write-back success):

```json
{
  "demo_url": "string — time-limited shareable preview URL",
  "expires_at": "string — ISO 8601 UTC expiry timestamp",
  "write_back_status": "string — committed | skipped",
  "activity_iri": "string | null — CE PROV-O activity IRI (null if skipped)",
  "applied_count": "integer | null — nodes/edges applied (null if skipped)"
}
```

Response `200` (deploy failed — not 5xx; prior state preserved):

```json
{
  "deploy_status": "failed",
  "error": "string — deploy error message",
  "prior_demo_url": "string | null — prior URL if one existed, else null"
}
```

Response `200` (write-back rolled back):

```json
{
  "write_back_status": "rolled_back",
  "violations": [
    {
      "focus_node": "string — IRI of the failing node",
      "path": "string — SHACL property path",
      "severity": "string — Violation | Warning | Info",
      "message": "string — human-readable violation message"
    }
  ],
  "deploy_status": "rolled_back"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Project or task not found | `{"error": "not_found"}` |
| 503 | `CE-WRITE-1` unreachable (triggers deploy rollback) | `{"error": "ce_write_unavailable", "deploy_status": "rolled_back"}` |

**`GET /api/projects/{project_iri}/demo`**

Response `200`:

```json
{
  "demo_url": "string | null — current demo URL, null if never deployed",
  "expires_at": "string | null — ISO 8601 UTC, null if never deployed",
  "deploy_status": "string — success | failed | never_deployed"
}
```

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#deploy-and-write-back-flow` | Deploy → SHACL validate → CE-WRITE-1 → rollback-on-422 sequence |
| State | `../tech-spec/business-process.md` | `#gate-flow` | Gate-flow diagram (build-engine.md §4) showing WRITEBACK and DoD positions |
| Data Model | `../tech-spec/data-model.md` | `#projects-demo-and-write-back-fields` | `demo_url`, `demo_expires_at`, `write_back_status` columns on `projects` table |

All three are pending tech-spec additions (DoR blockers).

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| CE-WRITE-1 is the ONLY mutation entry point | [contracts.md `CE-WRITE-1`](../../../../contracts.md#ce-write-1) | No direct SPARQL Update or legacy `POST /api/llm/mutate` calls; all mutations via `POST /api/operations/apply` |
| 422 from CE-WRITE-1 → feature-flag rollback | [build-engine.md FR-035](../../../build-engine.md#21-functional-requirements) | `preview_deployer.rollback(feature_flag)` is the rollback mechanism; feature-flag name recorded at deploy time |
| BE-ARTEFACT-1 provenance header on every entity | [contracts.md `BE-ARTEFACT-1`](../../../../contracts.md#be-artefact-1) | `{spec_id, pinned_version_iri, entity_iris}` header included in `CE-WRITE-1` operations payload |
| Spike mode: no write-back, no prod merge | [build-engine.md EPIC-006 decision B4](../../../build-engine.md#key-decisions) | `task.run_mode == "spike"` guard before any `ce_write_client.post(...)` call |
| PROV-O activity attributed to Build service principal | [contracts.md `CE-WRITE-1`](../../../../contracts.md#ce-write-1) + [contracts.md `PLAT-IDENTITY-1`](../../../../contracts.md#plat-identity-1) | `actor` field = `BUILD_SERVICE_PRINCIPAL_IRI` from `PLAT-IDENTITY-1`; not the user's JWT sub |
| CE-WRITE-1 unreachable → rollback deployed artefact | [build-engine.md FR-035](../../../build-engine.md#21-functional-requirements) | Graph and deployed state must never silently diverge; deploy is reversed if write-back cannot complete |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 200 with deploy_failed and retain prior_demo_url when deploy raises DeployError`
- `should skip write-back and return skipped reason when run_mode is spike`
- `should call CE-WRITE-1 with BE-ARTEFACT-1 provenance header fields`
- `should rollback deploy and return violations when CE-WRITE-1 returns 422`
- `should rollback deploy and return 503 when CE-WRITE-1 raises ConnectionError`
- `should include expires_at ISO 8601 timestamp in demo URL response`

### Integration Tests (minimum 3)

- `should emit PROV-O activity to PLAT-AUDIT-1 on successful write-back`
- `should record write_back_fail_shacl audit event on 422 from CE-WRITE-1`
- `should persist demo_url and demo_expires_at to Aurora projects table on success`

### E2E Tests

N/A — deploy pipeline is backend-only in M1; covered by integration tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Integration | `should persist demo_url and demo_expires_at to Aurora projects table on success` |
| AC-2 | Unit | `should return 200 with deploy_failed and retain prior_demo_url when deploy raises DeployError` |
| AC-3 | Unit | `should call CE-WRITE-1 with BE-ARTEFACT-1 provenance header fields` |
| AC-4 | Unit | `should rollback deploy and return violations when CE-WRITE-1 returns 422` |
| AC-5 | Integration | `should record write_back_fail_shacl audit event on 422 from CE-WRITE-1` |
| AC-6 | Unit | `should skip write-back and return skipped reason when run_mode is spike` |
| AC-7 | Integration | `should emit PROV-O activity to PLAT-AUDIT-1 on successful write-back` |
| AC-8 | Unit | `should include expires_at ISO 8601 timestamp in demo URL response` |

## Dependencies

- **blocked_by:** [TASK-007, TASK-008]
- **unlocks:** []
- **External prerequisites:** `"CE-WRITE-1 endpoint available in staging"`, `"Preview deployment infrastructure (Lambda + CloudFront + S3) provisioned"`, `"Feature-flag service available for deployment rollback"`, `"PLAT-AUDIT-1 emit endpoint available"`, `"PLAT-IDENTITY-1 service principal IRI for Build service registered"`

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~11k input, ~5k output
- **Estimated cost:** ~$0.60 (claude-fable-5 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included (3 pending — DoR blockers for tech-spec pass)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided
- [ ] Tech-spec deploy sequence and write-back flow diagrams created (DoR blockers)
- [ ] Feature-flag rollback mechanism identified and provisioned

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

- The `preview_deployer.rollback(feature_flag)` call must be idempotent — if the deploy
  already partially failed, a second rollback call must not raise an error (use a feature-flag
  SDK that supports safe-rollback semantics).
- `extract_entity_iris(task)` should parse the tech-spec section of the approved spec for
  mentions of named BPMO kinds (`System`, `Service`, `DataAsset`) and resolve them to IRIs via
  `CE-READ-1` — do not invent IRIs. The 200-node context cap (OQ-11) applies here too.
- The SHACL validation in CE-WRITE-1 runs on a throwaway clone server-side (per the contract);
  the Build service does not need to run SHACL locally. Trust the 422 response body — parse
  `violations` directly from it.
- `DEMO_URL_TTL_HOURS` should default to 72 and be overridable via `PLAT-SETTINGS-1`
  (`demo_url_ttl_hours` setting at workspace level); load it at deploy time.
- The `BUILD_SERVICE_PRINCIPAL_IRI` is registered with `PLAT-IDENTITY-1` at service startup
  (not per-request); cache it in a module-level constant populated from the identity service
  on first call, not from an environment variable.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

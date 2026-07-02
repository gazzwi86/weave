---
type: Task
title: "Task: TASK-004 — Request Studio: Blast-Radius, Cost Gate & Stakeholder Sign-Off (E1-S2/S3/S4)"
description: "Implement blast-radius impact analysis, cost-estimate gate, and stakeholder sign-off workflow; auto-create the project record on full approval."
tags: [build-engine, arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-001
milestone: M1
created: 2026-07-01
blocked_by: [TASK-001, TASK-003]
unlocks: [TASK-006]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m1/tasks/TASK-004.md
---

# Task: TASK-004 — Request Studio: Blast-Radius, Cost Gate & Stakeholder Sign-Off (E1-S2/S3/S4)

## Story

**Epic:** [EPIC-001 — Request Studio](../../../build-engine.md#epic-001--request-studio)
**Status:** Backlog
**Priority:** Must Have

**As a** product owner
**I want** to see which domains and services my request will affect, understand its estimated
cost, and collect stakeholder approval before any project is created
**So that** the organisation has visibility and governance over what gets built before resources
are committed

> **FRs covered:** FR-003 (blast-radius panel via `CE-READ-1`), FR-004 (cost-estimate gate via
> `PLAT-SETTINGS-1`), FR-005 (stakeholder sign-off via `CE-READ-1`; Approve → auto-create
> project via TASK-001 `POST /api/projects`).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/requests/{id}/blast-radius` is called on a `draft_complete` request, THE SYSTEM SHALL query `CE-READ-1` for domains and services touched by the draft spec's entity IRIs and return `200` with `{domains: [...], services: [...], entity_count: N}` | `test_blast_radius_returns_touched_domains_and_services` |
| AC-2 | WHEN `CE-READ-1` is unreachable during blast-radius computation, THE SYSTEM SHALL return `200` with `{status: "unavailable", message: "review manually"}` and hold project creation until a human acknowledges — it MUST NOT return `5xx` or block the request | `test_blast_radius_returns_unavailable_when_ce_unreachable` |
| AC-3 | WHEN `GET /api/requests/{id}/cost-estimate` is called, THE SYSTEM SHALL resolve the per-spec cap from `PLAT-SETTINGS-1` cascade (tighter-wins) and return `200` with `{estimate_usd: N, cap_usd: N, cap_level: "company|domain|workspace", exceeds_cap: true|false}` | `test_cost_estimate_returns_cap_and_flag` |
| AC-4 | WHEN `exceeds_cap: true`, THE SYSTEM SHALL prevent `POST /api/requests/{id}/sign-off` from advancing to approval and return `403 {"error": "cost_cap_exceeded", "cap_usd": N, "estimate_usd": N}` | `test_sign_off_blocked_when_cost_cap_exceeded` |
| AC-5 | WHEN `POST /api/requests/{id}/sign-off` receives an approval from a stakeholder resolved via `CE-READ-1` and all required stakeholders have approved, THE SYSTEM SHALL call `POST /api/projects` (TASK-001) to auto-create the project, transition the request to `approved`, and return `200` with `{status: "approved", project_iri: "<iri>"}` | `test_sign_off_all_approved_creates_project` |
| AC-6 | WHEN any stakeholder submits `action: "reject"` to `POST /api/requests/{id}/sign-off`, THE SYSTEM SHALL transition the request to `Draft` status, record the rejection reason, and return `200` with `{status: "returned_to_draft", rejection_reason: "<text>"}` | `test_sign_off_reject_returns_to_draft` |
| AC-7 | WHEN `blast_radius_acknowledged: false` and the blast-radius status is `"unavailable"`, THE SYSTEM SHALL reject `POST /api/requests/{id}/sign-off` with `422 {"error": "blast_radius_not_acknowledged"}` | `test_sign_off_blocked_until_blast_radius_acknowledged` |
| AC-8 | WHEN an unauthenticated request reaches any endpoint in this task, THE SYSTEM SHALL return `401 {"error": "unauthorised"}` with `Www-Authenticate: Bearer` | `test_all_endpoints_401_without_jwt` |

## Implementation

### Pseudocode

```
function get_blast_radius(jwt, request_id):
  claims = cognito.verify(jwt)           # → 401
  request = aurora.get_request(request_id, tenant=claims.tenant_id)
  if not request: return 404 with {"error": "not_found"}

  try:
    draft_iris = extract_entity_iris(request.draft_content)  # parse spec for IRI mentions
    result = ce_read_client.sparql(BLAST_RADIUS_QUERY, entity_iris=draft_iris)
    domains = [r["domain"] for r in result if r.get("domain")]
    services = [r["service"] for r in result if r.get("service")]
    aurora.update_request(request_id, blast_radius_status="computed")
    return 200 with {"domains": domains, "services": services,
                     "entity_count": len(draft_iris), "status": "computed"}
  except ConnectionError:
    aurora.update_request(request_id, blast_radius_status="unavailable")
    return 200 with {"status": "unavailable", "message": "review manually"}


function get_cost_estimate(jwt, request_id):
  claims = cognito.verify(jwt)           # → 401
  request = aurora.get_request(request_id, tenant=claims.tenant_id)
  if not request: return 404 with {"error": "not_found"}

  cap = plat_settings_client.resolve_cap(
    tenant_id=claims.tenant_id, setting="spec_cost_cap_usd"
  )  # cascade: Company→Domain→Workspace→Project; tighter-wins
  estimate = estimate_spec_cost(request.draft_content)  # token-count heuristic

  exceeds = estimate > cap["value"]
  return 200 with {"estimate_usd": estimate, "cap_usd": cap["value"],
                   "cap_level": cap["level"], "exceeds_cap": exceeds}


function submit_sign_off(jwt, request_id, action, rejection_reason=None,
                          blast_radius_acknowledged=False):
  claims = cognito.verify(jwt)           # → 401
  request = aurora.get_request(request_id, tenant=claims.tenant_id)
  if not request: return 404 with {"error": "not_found"}

  # Gate: blast-radius must be acknowledged if unavailable
  if request.blast_radius_status == "unavailable" and not blast_radius_acknowledged:
    return 422 with {"error": "blast_radius_not_acknowledged"}

  # Gate: cost cap
  estimate = get_cost_estimate_value(request)
  cap = plat_settings_client.resolve_cap(claims.tenant_id, "spec_cost_cap_usd")
  if estimate > cap["value"]:
    return 403 with {"error": "cost_cap_exceeded", "cap_usd": cap["value"],
                     "estimate_usd": estimate}

  stakeholder_iri = resolve_stakeholder(claims.sub, ce_read_client)  # from CE-READ-1

  if action == "reject":
    aurora.record_sign_off(request_id, stakeholder_iri, "rejected", rejection_reason)
    aurora.update_request(request_id, status="Draft")
    return 200 with {"status": "returned_to_draft", "rejection_reason": rejection_reason}

  # action == "approve"
  aurora.record_sign_off(request_id, stakeholder_iri, "approved")
  required = resolve_required_stakeholders(request, ce_read_client)  # CE-READ-1 performedBy
  approvals = aurora.get_approvals(request_id)

  if all(s.iri in approvals for s in required):
    # Auto-create project (TASK-001)
    project = projects_client.post("/api/projects",
                                   jwt=jwt, name=request.name)
    aurora.update_request(request_id, status="approved",
                          project_iri=project["project_iri"])
    return 200 with {"status": "approved", "project_iri": project["project_iri"]}
  else:
    return 200 with {"status": "pending_approvals",
                     "remaining": [s.iri for s in required if s.iri not in approvals]}
```

### API Contracts

**`GET /api/requests/{request_id}/blast-radius`**

Response `200` (computed):

```json
{
  "status": "string — computed | unavailable",
  "domains": ["string — domain IRI"],
  "services": ["string — service IRI"],
  "entity_count": "integer — count of entity IRIs extracted from draft"
}
```

Response `200` (unavailable):

```json
{
  "status": "unavailable",
  "message": "review manually"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Request not found or belongs to another tenant | `{"error": "not_found"}` |

**`GET /api/requests/{request_id}/cost-estimate`**

Response `200`:

```json
{
  "estimate_usd": "number — estimated generation cost",
  "cap_usd": "number — resolved per-spec cap from cascade",
  "cap_level": "string — company | domain | workspace",
  "exceeds_cap": "boolean"
}
```

**`POST /api/requests/{request_id}/sign-off`**

Request body:

```json
{
  "action": "string — approve | reject (required)",
  "rejection_reason": "string | null — required when action is reject",
  "blast_radius_acknowledged": "boolean — required true when blast_radius_status is unavailable"
}
```

Response `200` variants:

```json
{ "status": "approved", "project_iri": "string" }
{ "status": "returned_to_draft", "rejection_reason": "string" }
{ "status": "pending_approvals", "remaining": ["string — stakeholder IRI"] }
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 403 | Cost cap exceeded | `{"error": "cost_cap_exceeded", "cap_usd": N, "estimate_usd": N}` |
| 404 | Request not found | `{"error": "not_found"}` |
| 422 | Blast-radius unavailable and not acknowledged | `{"error": "blast_radius_not_acknowledged"}` |
| 422 | `action` not in `[approve, reject]` | `{"error": "validation_error", "field": "action"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#sign-off-workflow` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |
| State | `../tech-spec/business-process.md` | `#request-status-states` | Pending — to be added alongside TASK-003 state diagram (DoR blocker) |
| Data Model | `../tech-spec/data-model.md` | `#sign-offs-table` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| PLAT-SETTINGS-1 four-level cascade (tighter-wins) for cost cap | [contracts.md `PLAT-SETTINGS-1`](../../../../contracts.md#plat-settings-1) | `resolve_cap` must call `PLAT-SETTINGS-1` read API and respect cascade precedence; default cap ~$25 |
| CE-READ-1 for stakeholder resolution and blast-radius | [contracts.md `CE-READ-1`](../../../../contracts.md#ce-read-1) | `authority()` + `performedBy` query patterns; unreachable CE = degraded, not blocked |
| Blast-radius unavailability: hold until human acknowledges | [build-engine.md EPIC-001 ACs](../../../build-engine.md#epic-001--request-studio) | `blast_radius_acknowledged` flag in sign-off body is the acknowledgement mechanism |
| Project auto-create on full approval → TASK-001 endpoint | [build-engine.md §3 EPIC-002 M1 note](../../../build-engine.md#epic-002--project-registry--settings) | Sign-off calls `POST /api/projects` (same service); no circular dep — both run in the Build service |
| No-self-approval invariant | [build-engine.md decision B4](../../../build-engine.md#key-decisions) | Stakeholder IRIs resolved from CE; the submitting principal's IRI must NOT match the approving stakeholder IRI required for that role — enforced in `resolve_required_stakeholders` |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 401 when JWT is absent on blast-radius endpoint`
- `should return 200 with unavailable when CE-READ-1 unreachable in blast-radius`
- `should return 403 when estimate exceeds resolved cap in sign-off`
- `should return 422 when blast_radius_acknowledged is false and status is unavailable`
- `should return 422 when action is not approve or reject`
- `should transition request to Draft and record rejection_reason on reject action`

### Integration Tests (minimum 3)

- `should compute blast radius touching correct domains when CE-READ-1 returns data`
- `should create project via POST /api/projects when all stakeholders approve`
- `should return pending_approvals when not all stakeholders have approved`

### E2E Tests

N/A — no UI surface in M1; covered by integration tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Integration | `should compute blast radius touching correct domains when CE-READ-1 returns data` |
| AC-2 | Unit | `should return 200 with unavailable when CE-READ-1 unreachable in blast-radius` |
| AC-3 | Unit | `should return 403 when estimate exceeds resolved cap in sign-off` |
| AC-4 | Unit | `should return 403 when estimate exceeds resolved cap in sign-off` |
| AC-5 | Integration | `should create project via POST /api/projects when all stakeholders approve` |
| AC-6 | Unit | `should transition request to Draft and record rejection_reason on reject action` |
| AC-7 | Unit | `should return 422 when blast_radius_acknowledged is false and status is unavailable` |
| AC-8 | Unit | `should return 401 when JWT is absent on blast-radius endpoint` |

## Dependencies

- **blocked_by:** [TASK-001, TASK-003]
- **unlocks:** [TASK-006]
- **External prerequisites:** `"PLAT-SETTINGS-1 settings resolution endpoint available"`, `"CE-READ-1 endpoint available in staging"`

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
- [ ] Tech-spec diagrams created (DoR blocker)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-001

## Implementation Hints

- The BLAST_RADIUS_QUERY should use CE-READ-1's SPARQL endpoint with a `VALUES` clause to
  inject the draft entity IRIs: `SELECT ?domain ?service WHERE { VALUES ?e { <iri1> <iri2> } ...
  }` — this avoids N+1 CE calls.
- `PLAT-SETTINGS-1` returns the effective value and the level it was set at; cache the response
  for the duration of a single request (not across requests) to avoid stale cap enforcement.
- The no-self-approval check: after resolving stakeholder IRIs from CE, compare against
  `claims["custom:principal_iri"]` (the agent's registered IRI) — fail with
  `403 {"error": "self_approval_not_permitted"}` if they match.
- `sign-off` approvals are stored in a `request_sign_offs` table keyed by
  `(request_id, stakeholder_iri)` with a unique constraint — idempotent on double-submit.
- When calling `POST /api/projects` in the auto-create path, pass the request name as the
  project name; if project creation fails (503), do NOT mark the request approved — surface
  the error and leave it in the sign-off pending state.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

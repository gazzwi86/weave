---
type: Task
title: "Task: TASK-022 — External-Space Bindings (FR-010): Confluence/Jira/ServiceNow by Reference"
description: "Bindings CRUD + settings-tab UI over PLAT-CONNECTOR-1 instance handles: bind a
  project to external spaces by reference (no credential in Build), render live health from
  the connector health-read API with an honest 'health unavailable' state."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-010, TASK-015]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-022.md
---

# Task: TASK-022 — External-Space Bindings (FR-010): Confluence/Jira/ServiceNow by Reference

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** project admin
**I want** to bind my project to the right Confluence space, Jira board, and ServiceNow
project by reference
**So that** agents pull from and push to the correct external spaces without Build ever
holding a connector credential

> **FRs covered:** FR-010 (E2-S5). **Program dependency:** live behaviour requires the
> Platform v1 connector delivery (PLAT-CONNECTOR-1 — config + health + ingestion, v1.0).
> This task flips TASK-015's disabled slots live. If Platform's connector tasks have not
> landed when this task reaches Ready, it holds there (DAG below) — the UI meanwhile keeps
> the honest placeholder.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a project admin binds an external space, THE SYSTEM SHALL store `{system, connector_ref, space_ref}` where `connector_ref` is a PLAT-CONNECTOR-1 **connector instance handle** — no credential, token, or URL secret is stored in Build | `should store binding as instance handle reference only` |
| AC-2 | WHEN a binding is created against a connector instance the tenant has not configured, THE SYSTEM SHALL reject with a named error listing available instances (from the connector registry read) | `should reject binding to unknown connector instance` |
| AC-3 | WHEN the bindings tab renders, THE SYSTEM SHALL show each binding's health from the PLAT-CONNECTOR-1 health-read API (`status, last_sync, last_error, error_count`, skipped-count); WHEN the health read fails, THE SYSTEM SHALL show "health unavailable" — never a fake green | `should show health unavailable when connector health read fails` |
| AC-4 | WHEN a duplicate binding `(system, space_ref)` on the same connector instance is submitted, THE SYSTEM SHALL reject via the TASK-010 unique constraint with a friendly conflict message | `should reject duplicate binding with conflict message` |
| AC-5 | WHEN bindings are mutated, THE SYSTEM SHALL require the BINDINGS guard class (project admin / company-or-domain admin-owner); denial = 403 + audit | Role Guard suite (TASK-011); route registration asserted here |
| AC-6 | WHEN an agent context is assembled for a project with bindings, THE SYSTEM SHALL expose the bindings (system + refs) in the run context so agents target the bound spaces — delivery/ingestion itself stays Platform-owned | `should expose bindings in run context` |

## Implementation

### Pseudocode

```
GET/PUT/DELETE /api/projects/{id}/bindings (guard: BINDINGS):
    PUT: instances = connector_client.list_instances(tenant)         # AC-2
         if body.connector_ref not in instances: raise 422 UnknownInstance(available=[...])
         repo.bindings.put(project, system, connector_ref, space_ref)  # unique -> 409 (AC-4)
    GET: rows = repo.bindings.get_all(project)
         for row: row.health = connector_client.health(row.connector_ref)
                  on error -> row.health = "unavailable"              # AC-3, per-row isolation

run-context assembly (orchestrator, one addition):
    ctx.external_bindings = repo.bindings.get_all(project)            # AC-6, refs only

UI (settings integrations tab — replaces TASK-015 placeholders):
    per system: bound -> BindingCard(space_ref, HealthBadge) | unbound -> BindDialog
    BindDialog: instance select (from registry read) -> space/board/project key input
    HealthBadge states: ok | degraded | error | unavailable (text + colour, never colour alone)
```

### API Contracts

`GET/PUT /api/projects/{id}/bindings` p95 ≤ 400 ms (health reads are per-row and
best-effort — a slow connector degrades one badge, not the request; v1-delta §3). Errors:
403, 404, 409 (duplicate), 422 (unknown instance), 500. Consumes PLAT-CONNECTOR-1: instance
registry read + health-status read API. **Build calls no space-level external API** —
validation of `space_ref` existence is connector-side (delivery interface), not Build's.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 External bindings bullet | Instance-handle model + health surface |
| Contract | `../../../../contracts.md` | §PLAT-CONNECTOR-1 | Instance-scoped handles; health dimensions incl. skipped-count; Atlassian/ServiceNow write-back allowlist |
| Data model | `../../tech-spec/v1-delta.md` | §4 `external_bindings` | Table + uniqueness |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Bind by instance handle, not connector type | PLAT-CONNECTOR-1 (ADR-015/017 upstream) | Two Jira sites in one tenant bind unambiguously |
| Health is read-through, never stored | AC-3 | Build shows the connector's truth or "unavailable"; no stale cached green |
| `space_ref` validity is connector-side | API contract note | Build stays credential-free; a bad key surfaces as connector health/delivery errors, honestly |
| Bindings exposed to run context as refs only | AC-6 / B5 partition | Agents know *where*; Platform's delivery interface does the *how* |

## Test Requirements

### Unit Tests (minimum 3)

- `should reject binding to unknown connector instance`
- `should reject duplicate binding with conflict message`
- `should show health unavailable when connector health read fails` (component, per-row)

### Integration Tests (minimum 3)

- `should store binding as instance handle reference only` (row content asserted; no secret
  columns — Law B)
- `should expose bindings in run context` (orchestrator context assembly with seeded bindings)
- `should isolate slow health read to one badge` (one stub delayed; request within p95)

### E2E Tests (Playwright, minimum 1)

- `should bind jira board and see health badge end to end` (connector stub registry +
  health; `external_bindings` row asserted server-side)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should store binding as instance handle reference only` |
| AC-2 | Unit | `should reject binding to unknown connector instance` |
| AC-3 | Unit + Integration | health-unavailable component / slow-read isolation |
| AC-4 | Unit | `should reject duplicate binding with conflict message` |
| AC-5 | Integration | Role Guard suite; route registration check |
| AC-6 | Integration | `should expose bindings in run context` |

## Dependencies

- **blocked_by:** [TASK-010, TASK-015] (table; the settings tab whose placeholders this
  replaces)
- **unlocks:** []
- **External prerequisites:** **PLAT-CONNECTOR-1 instance registry + health-read API live
  (Platform v1 delivery)** — cross-engine DAG dependency; coordinator tracks the Platform
  task IDs. Tests run against the connector stub regardless (Law F), so implementation can
  precede Platform go-live behind the existing placeholder.

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~14k input, ~7k output
- **Estimated cost:** ~$0.50 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (incl. cross-engine prerequisite)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (connector stub, Law F)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] No token/secret column in the bindings migration (invariants.md verify-by)
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the settings
      route with the integrations tab live (v1-delta §6)
- [ ] `ui_verify` passes; design tokens only; health badge never colour-alone
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on public APIs/components
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- The connector client is Platform's — import their client module/stub; do not hand-roll
  HTTP calls to connector endpoints in Build.
- Health reads on GET are parallel with a short per-read timeout (one slow connector must not
  drag the tab); "unavailable" is the timeout result, not an exception path.
- The skipped-count health dimension matters to agents (sustained skips = the bound space's
  data isn't landing in the graph) — surface it on the badge detail, not just status colour.
- When replacing TASK-015's placeholder cards, keep the "available when connectors ship"
  component for tenants whose connector instances aren't configured yet — absence of
  instances is a normal state, not an error.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

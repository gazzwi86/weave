---
type: Task
title: "Task: TASK-015 — Activation Pipeline: Save as Draft, Test (Dry-Run), Activate"
description: "The fail-closed activation gate battery (schema, DAG, phase-gated nodes, grounding,
  HITL completeness, high-value gate, connector health, secret-scan), dry-run Test with zero side
  effects, and the publish step (snapshot, pin, principal, endpoints)."
tags: [events-actions-engine, arch, task, phase-1, post-v1]
status: Backlog
priority: Must Have
entity: events-actions-engine
epic: EPIC-002
milestone: post-v1
created: 2026-07-06
blocked_by: ["TASK-003", "TASK-006", "TASK-008", "TASK-009", "TASK-010", "TASK-014"]
unlocks: ["TASK-017"]
adr_refs: [ADR-002, ADR-005]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [events-actions-engine.md](../../../events-actions-engine.md)
Contracts: [contracts.md](../../../../contracts.md) · Flow:
[business-process.md §Activation Validation](../../tech-spec/business-process.md)

## Story

As an automation author, I want to save a draft, dry-run it against a sample payload, and
activate it only when every governance gate passes, so that nothing goes live ungrounded,
unscanned, or ungated.

## Scope Note

Implements E2-S3 + FR-008 + the activation halves of E4/E5/E6: the ordered gate battery
(business-process.md flowchart is normative), the dry-run Test executor (interpreter in simulate
mode — no external calls, no `CE-WRITE-1`, no metering), and the publish step (immutable
`automation_version` snapshot, ontology pin via TASK-003, principal minting via TASK-006/ADR-002,
webhook endpoint + schedule issuance via TASK-008, connector health check via TASK-009). The
secret-scan reuses the platform scrubber pattern set — fail-closed on scanner unavailability.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-015-01 | WHEN "Save as Draft" is clicked THE SYSTEM SHALL persist the definition and NOT run it. |
| AC-015-02 | WHEN "Test" runs with a sample payload THE SYSTEM SHALL execute in dry-run mode: no real external call, no graph write, no metering event — showing per-step expected results marked simulated. |
| AC-015-03 | WHEN "Activate" is clicked THE SYSTEM SHALL run the battery in order: schema validity → connected DAG → phase-gated nodes (any node requiring `CE-EVENT-1`/`CE-WRITE-1`/`BE-SELFIMPROVE-1` blocks with flagged nodes) → grounding resolves in a PUBLISHED version → HITL config completeness → high-value actions carry a HITL gate → connector health OK → secret-scan; the FIRST failure blocks with its specific message. |
| AC-015-04 | IF the secret-scan service is unavailable THEN THE SYSTEM SHALL fail closed: "secret-scan unavailable — cannot activate". |
| AC-015-05 | IF the grounding IRI does not resolve in the target published version THEN THE SYSTEM SHALL block with "grounding entity not found in the selected published version". |
| AC-015-06 | WHEN all gates pass THE SYSTEM SHALL atomically: snapshot `automation_version`, pin the newest published `version_iri` (`CE-VERSION-1`), mint the per-automation principal (`PLAT-IDENTITY-1`), issue webhook endpoints/schedules, and set status Active — a failure in any publish step SHALL roll back the whole activation. |
| AC-015-07 | WHEN a detected credential appears anywhere in the definition THE SYSTEM SHALL block activation naming the field (scan reuses the platform scrubber patterns — not reinvented). |

## API Contracts

Consumes **CE-READ-1**/**CE-VERSION-1** (via TASK-003), **PLAT-IDENTITY-1** (principal),
**PLAT-CONNECTOR-1** health (via TASK-009), the platform secret-scan pattern set. Engine-internal:
`POST /api/automations/{id}/draft|test|activate`.

## Diagram

Normative flow: [business-process.md §Activation Validation Flow](../../tech-spec/business-process.md)
(ordered battery, fail-closed branches, publish step). Not restated here.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Ordered battery, first-failure-wins, cheapest-first | Deterministic errors; no partial validation states to reason about | E2-S3 |
| Dry-run = interpreter in simulate mode, not a parallel evaluator | One execution semantic; Test exercises the real walk | E2-S3, Law E |
| Publish step atomic with rollback | A half-activated automation (endpoint live, no principal) is a security hole | AC-015-06 |
| Scanner outage = block | Fail-open would make the scan decorative | FR-008 |
| Phase-gated node check inside the battery | The D9 flagged-unavailable rule enforced where it bites | arch D9 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Battery ordering: each gate independently forced to fail; first failure reported | AC-015-03 |
| Unit | Scan patterns detect seeded credentials; scanner-error ⇒ block | AC-015-04/07 |
| Integration | Dry-run: recording stubs assert zero external calls / writes / metering | AC-015-02 |
| Integration | Full activate happy path: snapshot + pin + principal + endpoints, atomically | AC-015-06 |
| Integration | Publish-step failure injection (principal mint fails) ⇒ full rollback | AC-015-06 |
| Integration | Phase-gated template definition blocks with flagged nodes | AC-015-03 |
| E2E | Draft → Test → Activate journey; scanner-down branch shows fail-closed message | AC-015-01/02/04 |

## Dependencies

- **blocked_by**: TASK-003 (grounding/pin), TASK-006 (gate config + principal), TASK-008
  (endpoint issuance), TASK-009 (health check), TASK-010 (action set to dry-run), TASK-014
  (canvas-visible validation states)
- **unlocks**: TASK-017 (templates activate through this battery)

## Cost Estimate

**L** — integrates six upstream modules and owns the engine's most important fail-closed
guarantees; the atomic publish + rollback needs careful transaction design across external mints.

## DoR Checklist

- [ ] All six blocking tasks merged
- [ ] Platform scrubber pattern set version pinned
- [ ] Publish-step compensation strategy reviewed (principal/endpoint cleanup on rollback)
- [ ] Battery order confirmed against business-process.md flowchart (normative)

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] Every battery gate has a forced-failure test AND a fail-closed outage test where applicable
- [ ] No activation path bypasses the battery (single entry point, grep/CI assertion)
- [ ] Rollback leaves zero orphaned principals/endpoints/schedules (verified by stubs)
- [ ] Coverage ≥ 80%, mutation ≥ 70% on the battery module

## Implementation Hints

External mints (principal, endpoints, schedules) cannot join a DB transaction — use a saga:
record intents in the activation row, execute mints, then flip status; on failure run
compensations in reverse and mark the attempt failed with causes. Dry-run mode is a dispatcher
substitution (simulated transports injected into the TASK-004 interpreter), not conditional
logic inside real dispatchers — keeps Law-F purity and prevents a "test flag" ever reaching
production dispatch.

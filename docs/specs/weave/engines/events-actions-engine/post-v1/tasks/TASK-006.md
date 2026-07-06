---
type: Task
title: "Task: TASK-006 — Deterministic Governance Gate & HITL Approval Lifecycle"
description: "The 4-step deterministic gate (deny → authority → automatable → HITL) before every
  autonomous action, per-automation principals, the HITL pause/notify/approve/reject/escalate
  lifecycle, and the no-self-approval invariant."
tags: [events-actions-engine, arch, task, phase-1, post-v1]
status: Backlog
priority: Must Have
entity: events-actions-engine
epic: EPIC-005
milestone: post-v1
created: 2026-07-06
blocked_by: ["TASK-004", "TASK-003", "TASK-002"]
unlocks: ["TASK-010", "TASK-011", "TASK-015"]
adr_refs: [ADR-002]
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
[business-process.md §Governance Gate](../../tech-spec/business-process.md)

## Story

As an operations owner, I want a deterministic governance gate before any autonomous action so
that sensitive actions cannot proceed without the right human approving them — and the automation
can never approve itself.

## Scope Note

Implements E5-S5 + the decision half of FR-029b on the TASK-004 pause mechanics: the gate function
plugged into the stepper's pre-dispatch hook, per-automation principal minting at activation
(`PLAT-IDENTITY-1`, ADR-002 §4), the HITL gate lifecycle (pause → notify approvers → decide →
resume/terminate → escalate-on-deadline), and audit emission of decisions (via the TASK-007
emitter once landed; buffered locally until). Grounded-step facts (explicit deny, authority,
`automatable`) come from TASK-003's CE-READ-1 access.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-006-01 | WHEN any autonomous action (Agent Run, high-value API call; Phase 2 adds Graph Update) is about to dispatch THE SYSTEM SHALL evaluate, in order: (1) explicit deny on the grounded step ⇒ blocked regardless of authority; (2) principal authority < required ⇒ route to human; (3) `automatable` false OR ABSENT (CE-owned SHACL boolean, default false) ⇒ route to human regardless of any value threshold; (4) HITL trigger configured or high-value threshold (TASK-002) crossed ⇒ gate fires. |
| AC-006-02 | WHEN authority is evaluated THE SYSTEM SHALL apply `CE-READ-1` agent-grounding semantics: unstated permission ⇒ deny/route-to-human; an empty result SHALL never mean permitted; explicit deny overrides inferred authority. |
| AC-006-03 | WHEN an automation activates THE SYSTEM SHALL obtain a per-automation least-privilege service principal from `PLAT-IDENTITY-1` (scope derived from the grounded step); the principal IRI SHALL ride every audit event and (Phase 2) PROV-O attribution as `prov:SoftwareAgent`. |
| AC-006-04 | WHEN a HITL gate fires THE SYSTEM SHALL pause the run durably (TASK-004 mechanics), notify approver(s) in `escalatesTo` in-app + optional Slack via `PLAT-NOTIFY-1` (target ≤ 30 s) showing trigger, pending action, and Approve/Reject. |
| AC-006-05 | WHEN a decision is submitted THE SYSTEM SHALL accept it only from a human principal in `escalatesTo` — the automation's own principal SHALL be rejected (no-self-approval); approval resumes the run; rejection terminates it with a required reason; the decision (outcome, approver identity, ts, reason) is emitted as a distinct `PLAT-AUDIT-1` event. |
| AC-006-06 | IF the escalation deadline passes with no decision THEN THE SYSTEM SHALL escalate to `escalatesTo` (notify + optional Slack), keep the run paused, and NEVER auto-approve. |
| AC-006-07 | WHEN a definition's HITL gate lacks `escalatesTo`, `escalationDeadline`, or `triggeredByStep` THE SYSTEM SHALL fail validation (shared with TASK-001 schema; asserted here against the gate's own requirements). |

## API Contracts

Consumes **CE-READ-1** (grounded-step facts: deny/authority/`automatable` — via TASK-003),
**PLAT-IDENTITY-1** (principal minting), **PLAT-NOTIFY-1** (approver + escalation events),
**PLAT-AUDIT-1** (decision events), **PLAT-SETTINGS-1** (threshold/timeout via TASK-002). Exposes
engine-internal `POST /api/runs/{id}/decision`.

## Diagram

Flow diagram: [business-process.md §Governance Gate + HITL Flow](../../tech-spec/business-process.md)
— deterministic 4-step sequence + decision lifecycle (do not restate here).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Gate is deterministic interpreter code, never model judgement | Compliance must be provable; order is law | FR-022, arch D6 |
| `automatable` absent ⇒ false ⇒ human | CE owns the shape + default; safety never rests on an undefined attribute | contracts.md CE-READ-1 |
| No-self-approval enforced at the decision endpoint against `automation.principal_iri` | The invariant must hold for direct API calls, not just UI | PRD §2.2, E5-S5 |
| Deadline escalation keeps the run paused | Auto-approve on timeout would invert the gate's purpose | E5-S5 failure AC |
| Principal per automation (pooled-claims fallback recorded) | Least privilege derived from the grounded step | ADR-002 §4, OQ-10 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Gate order: deny beats authority beats automatable beats HITL; each short-circuits | AC-006-01 |
| Unit | Empty authority result ⇒ deny (never permit) | AC-006-02 |
| Unit | HITL config completeness | AC-006-07 |
| Integration | Full gate paths against grounded-step fixtures (deny / low authority / automatable absent / high-value) | AC-006-01/02 |
| Integration | Fire → notify (≤ 30 s via stub) → approve resumes / reject terminates with reason → audit event | AC-006-04/05 |
| Integration | Self-approval attempt by the automation principal rejected + logged | AC-006-05 |
| Integration | Deadline sweep escalates, stays paused, never auto-approves | AC-006-06 |

## Dependencies

- **blocked_by**: TASK-004 (pause mechanics + pre-dispatch hook), TASK-003 (grounded-step facts),
  TASK-002 (threshold/timeout)
- **unlocks**: TASK-010/011 (autonomous actions dispatch through the gate), TASK-015 (activation
  validates gate config + mints principal)

## Cost Estimate

**L** — security-critical logic with an approval lifecycle, an escalation sweep, and identity
integration; the gate-order property tests and no-self-approval surface need rigour.

## DoR Checklist

- [ ] TASK-003/004 merged; TASK-002 threshold available
- [ ] PLAT-IDENTITY-1 principal-minting API shape pinned
- [ ] Grounded-step fixture set (deny / authority / automatable states) built with TASK-003 owner
- [ ] PLAT-NOTIFY-1 hitl-gate-fired + escalation event types registered

## DoD Checklist

- [ ] All ACs pass (unit + integration)
- [ ] Property test: for all fixture permutations, no dispatch occurs without a gate decision record
- [ ] Grep/CI assertion: the action dispatch entry point requires a `GateDecision` argument
- [ ] Decision endpoint authenticates the approver as human (`PLAT-IDENTITY-1` class), not merely non-self
- [ ] Coverage ≥ 80%, mutation ≥ 70% on the gate module (this is the module mutation testing exists for)

## Implementation Hints

Model the gate as a pure function `(action, grounded_step_facts, principal, config, thresholds) →
GateDecision` — fetch facts before, decide purely, act after; purity is what makes the order
provable. The deadline sweep reuses the paused_run index `(tenant_id, decision,
escalation_deadline_at)`. Approver notification payload must NOT include interpolated action
payloads (may contain scrubbed-secret material) — show config summary + trigger metadata.

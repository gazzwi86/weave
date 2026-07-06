---
type: Task
title: "Task: TASK-011 — Activation Detection: poll-first recorder with exactly-once fire + outbox"
description: "The activation backbone: since-version poller over CE-VERSION-1/CE-READ-1 for
  Business/Technical/Compliance milestones in the user's OWN workspace, the ON-CONFLICT milestone
  recorder, the transactional outbox to PLAT-NOTIFY-1, and the celebratory toast — exactly once
  per (tenant, user, milestone)."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-005
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-001", "TASK-006"]
unlocks: ["TASK-015"]
adr_refs: [ADR-003, ADR-004]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E5-S2 / FR-022 · Contracts:
[contracts.md](../../../../contracts.md) · Flow:
[business-process.md](../../tech-spec/business-process.md) §Activation Detection

## Story

As the platform, I need to detect — without the user marking anything — that they reached their
path's first real outcome in their own workspace, celebrate it exactly once, and publish the
activation event, so the product's core adoption metric is trustworthy.

## Scope Note

Backend detector + recorder + dispatcher, SPA toast. Poll-first (ADR-004): a scheduled poller
per demo-active, not-fully-activated user resolves the latest published version of the user's
**own** workspace (CE-VERSION-1); on cursor advance it runs the milestone's named CE-READ-1
check — Business/Technical: first committed entity PROV-attributed to the user's principal
(Technical alternatively a SPARQL run); Compliance: first governance/SHACL view via CE-READ-1.
All routes through `record_milestone` → `INSERT … ON CONFLICT DO NOTHING` + outbox row in one
transaction (ADR-003). Outbox dispatcher publishes `onboarding-activation` to PLAT-NOTIFY-1 with
retry. Toast renders from the activation row (client state refresh). **Admin milestone: no
detector** — the TASK-010 self-mark routes through the same recorder. **CE-EVENT-1 consumer:
NOT built** — the recorder's entry point is the seam; the flag and consumer land when CE pins
transport. Locked milestones (unavailable engine/signal) are never evaluated. NO analytics event
sink (EPIC-008 deferred): the outbox's only event type is `onboarding-activation`; OTel spans
(activation-detect) are ops telemetry only.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-011-01 | WHEN the poller runs for a user THE SYSTEM SHALL check CE-VERSION-1 for their own workspace and only on cursor advance run the milestone's named CE-READ-1 check; the cursor SHALL advance only after a completed check cycle (ADR-004). |
| AC-011-02 | WHEN a milestone signal is found THE SYSTEM SHALL insert the activation row and its outbox row in one transaction via `ON CONFLICT DO NOTHING`; a conflicting (re-triggered) record SHALL produce no outbox row and no side effect — exactly once per `(tenant, user, milestone)` (FR-022). |
| AC-011-03 | WHEN an activation row is created THE SYSTEM SHALL auto-complete the matching checklist item (projection, TASK-010), fire the celebratory toast once, and publish `onboarding-activation` to PLAT-NOTIFY-1 via the outbox dispatcher (E5-S2). |
| AC-011-04 | IF PLAT-NOTIFY-1 is unavailable THEN THE SYSTEM SHALL retry outbox rows with backoff and never block or duplicate the toast/checklist (they read the activation row, not the outbox). |
| AC-011-05 | IF a milestone's engine or signal is unavailable THEN THE SYSTEM SHALL keep it locked and never evaluate it — no mis-fire; IF CE is unreachable mid-cycle THEN THE SYSTEM SHALL skip the cycle without moving the cursor (FR-022 failure modes). |
| AC-011-06 | WHEN the poller selects users THE SYSTEM SHALL only consider demo-active users with unfired milestones and SHALL stop polling a user once all applicable milestones fired (poll interval default 60 s, tunable). |
| AC-011-07 | WHEN detection runs THE SYSTEM SHALL evaluate signals only in the user's OWN workspace — never the sandbox (activation is a real-workspace outcome, E5-S2). |

## API Contracts

Consumes `CE-VERSION-1` (version cursor), `CE-READ-1` (milestone ASK/queries; PROV-attributed
entity checks), `PLAT-NOTIFY-1` (publish), `PLAT-IDENTITY-1` (user principal IRI for
attribution matching). CE-EVENT-1: explicitly not consumed in this slice (Consumed-Contract
Phase Map). Engine-internal: recorder function (shared with TASK-010 self-mark).

## Diagram

business-process.md §Activation Detection → Exactly-Once Fire (sequence);
architecture.md §Level 3 (`poller`, `recorder`, `outbox`).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Poll-first; event consumer later behind a flag | CE-EVENT-1 transport unpinned; degrade path is the built path | ADR-004 |
| Exactly-once = insert conflict, side effects from the winning txn | Correctness independent of transports and races | ADR-003 |
| Toast/checklist read activation rows, not notify | Notify outage cannot break or duplicate the celebration | ADR-003 |
| Own-workspace-only evaluation | Activation means a real outcome, not sandbox practice | E5-S2 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Recorder: winner writes outbox; loser writes nothing; source tagging | AC-011-02 |
| Unit | Poller: cursor rules; CE-outage skip; stop condition; locked skip | AC-011-01/05/06 |
| Integration | `test_activation_exactly_once` (release gate): concurrent poll + self-mark re-trigger ⇒ one row, one dispatch | AC-011-02/03 |
| Integration | Seeded own-workspace commit (PROV-attributed) ⇒ Business milestone fires; sandbox commit ⇒ does NOT | AC-011-01/07 |
| Integration | Notify stub outage ⇒ retry; `dispatched_at` set once on recovery | AC-011-04 |
| E2E | First entity in own workspace → toast once + checklist tick; repeat action ⇒ no second toast | AC-011-03 |

## Dependencies

- **blocked_by**: TASK-001 (activation/outbox tables), TASK-006 (per-path milestone set)
- **unlocks**: TASK-015 (idempotency E2E in exit suite)

## Cost Estimate

**L** — detection queries, poller lifecycle, transactional outbox, and the race-proof tests are
the dense core of the engine.

## DoR Checklist

- [ ] ADR-003 + ADR-004 approved
- [ ] Milestone signal definitions per path reviewed (E5-S2 table)
- [ ] PROV-attribution query shape validated against CE's shipped PROV structure
- [ ] Poll interval registered as a tunable

## DoD Checklist

- [ ] All ACs pass; `test_activation_exactly_once` in the release-gate suite
- [ ] Race test covers poll × self-mark × repeated poll concurrently
- [ ] OTel activation-detect span carries no PII attributes
- [ ] Coverage ≥ 80%, mutation ≥ 60% on recorder + poller (the mutation priority of this engine)

## Implementation Hints

`record_milestone(tenant, user, milestone, source)` is the single entry point — TASK-010's
self-mark and any future event consumer import it; nothing else touches the `activation` table
(enforce with a grep-style test). Use `INSERT … ON CONFLICT DO NOTHING RETURNING milestone_id`
— a non-empty return IS the "winner" signal that gates the outbox write in the same transaction.
The Compliance "governance/SHACL view" signal is a server-observed read (the view endpoint call
under the user's principal), not a client claim — route it through the same recorder from that
view's handler seam.

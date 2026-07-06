---
type: Task
title: "Task: TASK-009 — Hands-On Exercises CE-01/02/03/03b + GE-01/02 with contract-signal checks"
description: "The M1 exercise set in the writable sandbox: role-gated, phase-tagged, each with
  3–5 steps and a named completion check (SPARQL ASK / CE-WRITE-1 commit / GE-CANVAS-1 state /
  nav signal); completions persisted and re-earnable after reset."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-004
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-003", "TASK-004", "TASK-006"]
unlocks: ["TASK-015"]
adr_refs: [ADR-002, ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E4-S1/E4-S2 (exercise table) · Contracts:
[contracts.md](../../../../contracts.md) · Content:
[hammerbarn-content-brief.md](../../../../hammerbarn-content-brief.md)

## Story

As a new user, I want structured hands-on exercises in my Hammerbarn sandbox — find the gap,
add a category, query the unowned processes, spotlight Goods Inward — so I learn each capability
by doing, with completion verified against what actually happened, never "looks done".

## Scope Note

Frontend exercise panels + backend checker. The six M1 exercises from the PRD table, definitions
from TASK-003 config: CE-01 (nav signal: entity-list + missing-property view visited), CE-02
(NL add "Outdoor Furniture" → ASK over the user's sandbox graph after the CE-WRITE-1 commit),
CE-03 (raw SPARQL for Processes with no `performedBy` — **Technical only**), CE-03b (NL
equivalent — **Business**), GE-01 (Goods Inward spotlight — GE-CANVAS-1 state), GE-02 (maturity
heatmap overlay — Explorer overlay state). Backend `POST /api/onboarding/exercises/{id}/check`
runs the named signal and writes `exercise_completion` (TASK-001). Role/variant gating from
TASK-006 (read-only variant: write exercises shown locked). Checklist reflection is read-side in
TASK-010. BE-01/AE-01 are post-v1 — config admits them, nothing renders (phase tags).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-009-01 | WHEN the exercise list renders THE SYSTEM SHALL show only exercises matching the user's path/variant and shipped phase; a gated or unavailable exercise SHALL be hidden or shown disabled with an explanation — never a broken step (FR-016/FR-017). |
| AC-009-02 | WHEN an exercise write executes THE SYSTEM SHALL target the user's sandbox only via CE-WRITE-1 `target=draft` in the sandbox workspace context; NL/SPARQL input SHALL be validated at the boundary and forwarded to CE — no query construction in onboarding (PRD §2.4 security). |
| AC-009-03 | WHEN CE-02's check runs THE SYSTEM SHALL verify via SPARQL ASK over the user's sandbox graph (CE-READ-1) after the CE-WRITE-1 commit; WHEN CE-03/CE-03b run THE SYSTEM SHALL verify the query executed and returned rows (CE-READ-1 / NL mode); WHEN GE-01/GE-02 run THE SYSTEM SHALL verify canvas/overlay state (GE-CANVAS-1); WHEN CE-01 runs THE SYSTEM SHALL verify the nav signal — each completion records its `verified_signal` (FR-017). |
| AC-009-04 | WHEN a completion check passes THE SYSTEM SHALL persist `exercise_completion` with timestamp; IF the state write fails THEN THE SYSTEM SHALL retry and reflect the last persisted state — no silent loss (E4-S2 failure mode). |
| AC-009-05 | WHEN the sandbox is reset THE SYSTEM SHALL have cleared completion flags (TASK-005) and the same exercise SHALL be re-earnable end-to-end. |
| AC-009-06 | WHEN a Business-path user encounters the unowned-processes exercise THE SYSTEM SHALL route them to CE-03b (NL) — raw SPARQL is never required of the Business path (PRD §2.8). |
| AC-009-07 | WHEN an exercise panel renders THE SYSTEM SHALL show goal, 3–5 steps, and a completion indicator, all i18n/tokens, axe-clean. |

## API Contracts

Consumes `CE-READ-1` (ASK checks; CE-03 SPARQL through CE's single SELECT-only validator; NL via
`POST /api/query/nl`), `CE-WRITE-1` (CE-02 sandbox commit), `GE-CANVAS-1` (GE-01/02 state).
Engine-internal: `POST /api/onboarding/exercises/{id}/check`.

## Diagram

business-process.md §Sandbox Write + Canonical 403 Boundary (exercise write path);
architecture.md §Level 3 (`excheck` component).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Completion = named contract signal, server-verified | Client claims are spoofable; signals are the PRD's own table | FR-017 |
| ASK strings are static config, PR-reviewed | No user input ever concatenated into a query | ADR-006 / security.md |
| Check endpoint server-side, not SPA-side | The checker needs the caller's workspace context and RLS; and it writes state | ADR-003 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Gating matrix: path × variant × phase per exercise (CE-03 Tech-only, CE-03b Business) | AC-009-01/06 |
| Unit | Checker dispatch per signal kind; unknown kind rejected | AC-009-03 |
| Integration | CE-02 round-trip: NL write → ASK true → completion row (in-process CE + Oxigraph) | AC-009-02/03/04 |
| Integration | Reset → flags cleared → re-earn CE-02 | AC-009-05 |
| Integration | State-write failure ⇒ retry, last persisted state reflected | AC-009-04 |
| E2E | Business completes CE-03b via chat; Technical completes CE-03; GE-01 spotlight; backend rows asserted (Law B) | AC-009-02/03/06 |

## Dependencies

- **blocked_by**: TASK-003 (exercise config), TASK-004 (writable sandbox), TASK-006 (gating)
- **unlocks**: TASK-015 (exercise E2E in exit suite)

## Cost Estimate

**L** — six exercises across two engines with four signal kinds; the CE-02 round-trip and the
gating matrix carry the complexity.

## DoR Checklist

- [ ] TASK-004 merged (sandbox exists; boundaries proven)
- [ ] Exercise config (TASK-003) reviewed against the PRD exercise table verbatim
- [ ] GE-CANVAS-1 spotlight/overlay state read confirmed with Explorer's shipped surface
- [ ] CE `POST /api/query/nl` confirmed live (M1 contract)

## DoD Checklist

- [ ] All ACs pass; every completion path verified against a real signal in integration
- [ ] No SPARQL string built from user input anywhere (grep gate: no f-string/concat into query
      params in this module)
- [ ] Read-only variant shows write exercises locked with explanation
- [ ] Coverage ≥ 80%, mutation ≥ 60% on checker + gating
- [ ] `ui_verify` passes on exercise panels

## Implementation Hints

The ASK for CE-02 keys on `weave:Class` + `rdfs:label "Outdoor Furniture"` per the PRD — run it
with the sandbox workspace context so the rewriter scopes it (never pass a graph IRI from the
client). GE-01/GE-02 checks read the canvas state the Explorer already exposes through
GE-CANVAS-1 props/state — coordinate the exact state read with the Explorer surface rather than
scraping DOM. CE-01's nav signal is a client event posted to the check endpoint; it is the one
deliberately soft check (PRD marks it a UI-nav signal) — keep it honest by requiring both views
visited in one session.

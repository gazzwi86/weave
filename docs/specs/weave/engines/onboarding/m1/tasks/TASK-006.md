---
type: Task
title: "Task: TASK-006 — Role-Path Resolution: 10→4 mapping, choose-path, change-path"
description: "Resolves every signed-in user to exactly one of the 4 onboarding paths from
  canonical RBAC roles via PLAT-IDENTITY-1 (IdP-agnostic): total 10→4 mapping, multi-role
  choose prompt, zero-role/Viewer → Business read-only, and 'Change my onboarding path'."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-003
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-001"]
unlocks: ["TASK-007", "TASK-009", "TASK-010", "TASK-011", "TASK-014"]
adr_refs: [ADR-003]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) §2.1 personas + E3-S1 · Contracts:
[contracts.md](../../../../contracts.md)

## Story

As a new user, I want my onboarding tailored to my role from the moment I sign in, so tours,
exercises, and my first-outcome milestone point at what my job actually needs — and switching
paths is always one click away, never a support ticket.

## Scope Note

Backend resolution + SPA choose-path modal. Ships: the 10→4 mapping table (canonical platform
RBAC slugs → Business/Technical/Compliance/Admin, per the PRD personas table), resolution at
first sign-in via PLAT-IDENTITY-1 (never a raw Cognito group), the multi-role choose-path
prompt, zero-role/Viewer → Business **read-only variant** default, persistence in
`onboarding_state.role_path`/`path_variant` (TASK-001), and the "Change my onboarding path"
action (surfaced in the help launcher by TASK-013 — this task ships the endpoint + a directly
routable settings entry). Consumers key everything off the resolved path: tours (TASK-007),
exercise gating (TASK-009), checklist sets (TASK-010), milestones (TASK-011), widget mapping
(TASK-014) — the epic AC that no two surfaces can disagree on a user's path holds because all
read the same state row.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-006-01 | WHEN a signed-in user's path resolves THE SYSTEM SHALL map their canonical role(s) from PLAT-IDENTITY-1 to exactly one of the 4 paths per the mapping table; the mapping SHALL be total — every one of the 10 canonical roles maps, verified by a matrix test with no unmapped role (FR-013). |
| AC-006-02 | WHEN a user holds multiple roles at first sign-in THE SYSTEM SHALL prompt them to choose a starting path; the union of their roles' capabilities still governs what each exercise/tour can do (FR-014). |
| AC-006-03 | WHEN a user resolves with zero roles, or only Viewer/stakeholder, THE SYSTEM SHALL default them to the Business path read-only variant (exercises requiring writes shown locked). |
| AC-006-04 | WHEN any user invokes "Change my onboarding path" THE SYSTEM SHALL switch the persisted path at any time and downstream surfaces SHALL reflect it on next render. |
| AC-006-05 | WHEN role resolution executes THE SYSTEM SHALL read only canonical RBAC slugs via PLAT-IDENTITY-1 — no code path reads an IdP group directly (IdP-agnostic; import-level assertion). |
| AC-006-06 | IF PLAT-IDENTITY-1 is unreachable at resolution time THEN THE SYSTEM SHALL fall back to the Business read-only variant for the session without persisting, and retry persistence on next sign-in — never block entry. |

## API Contracts

Consumes `PLAT-IDENTITY-1` (canonical role slugs). Engine-internal:
`GET /api/onboarding/path` (resolved path + variant), `PUT /api/onboarding/path` (choose/change).

## Diagram

architecture.md §Level 3 (`pathres` component); business-process.md §First Sign-In (the alt
block).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Mapping table is config data, not branching code | Totality is testable as data; new roles are a row, not a refactor | E3-S1 |
| Path persisted once, read by all surfaces | The "two stories cannot disagree" epic AC by construction | EPIC-003 AC |
| Unreachable-IdP degrades to Business read-only, unpersisted | Never block first sign-in; never persist a guess | Law: fail safe |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Full matrix: 10 roles × expected path; no unmapped role (parameterised) | AC-006-01 |
| Unit | Multi-role → prompt flag; zero-role/Viewer → read-only variant | AC-006-02/03 |
| Unit | Import-level assertion: no IdP-SDK reference in the resolver | AC-006-05 |
| Integration | Choose + change persisted; downstream read reflects | AC-006-02/04 |
| Integration | Stubbed PLAT-IDENTITY-1 outage ⇒ session default, no persist | AC-006-06 |

## Dependencies

- **blocked_by**: TASK-001 (state row)
- **unlocks**: TASK-007, TASK-009, TASK-010, TASK-011, TASK-014 (all path consumers)

## Cost Estimate

**S** — a mapping table, two endpoints, one modal; the value is in the matrix test and the
fail-safe behaviour.

## DoR Checklist

- [ ] Canonical role-slug list confirmed from the platform RBAC model (10 roles)
- [ ] PRD personas mapping table (§2.1) reviewed as the source of truth
- [ ] TASK-001 merged (state row exists)

## DoD Checklist

- [ ] All ACs pass; the role-resolution matrix test is in the release-gate suite (roadmap exit)
- [ ] Choose-path modal: i18n keys, tokens, axe-clean, keyboard-navigable
- [ ] No IdP SDK import anywhere in this module
- [ ] Coverage ≥ 80%, mutation ≥ 60% on the resolver

## Implementation Hints

Keep the mapping in `packages/shared` beside the content config (TASK-003) so the SPA can label
paths without a round-trip — the backend resolver imports the same table (one source). The
read-only variant is a flag on the state row, not a fifth path — exercises consult
`path + variant`.

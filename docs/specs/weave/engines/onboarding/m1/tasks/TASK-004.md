---
type: Task
title: "Task: TASK-004 — Sandbox Provisioning, Canonical Template & the Three Isolation Boundaries"
description: "The security-load-bearing row: tenant-local canonical template materialisation,
  lazy per-user sandbox fork (sandbox-as-workspace), the demo switcher entry, Practice-mode
  banner + demo label, and the three isolation-boundary release-gate tests."
tags: [onboarding, arch, task, phase-1, m1, security]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-001
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-001", "TASK-002"]
unlocks: ["TASK-005", "TASK-009"]
adr_refs: [ADR-002, ADR-007]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) · Contracts:
[contracts.md](../../../../contracts.md) · Flow: [business-process.md](../../tech-spec/business-process.md)
§First Sign-In and §Sandbox Write + Canonical 403 Boundary

## Story

As a new user, I want my own isolated, writable Hammerbarn copy created the first time I open
the demo, so I can practise freely knowing my edits touch nobody else's data — and as the
platform owner, I need that isolation proven by release-gate tests, not asserted.

## Scope Note

Backend + one SPA seam. Ships: (1) per-tenant canonical template materialisation (create the
template workspace, apply the pinned seed batch via TASK-002's apply path, publish, set
read-only-to-non-content-admin permission); (2) lazy per-user sandbox fork on first demo access
(create workspace under the demo service principal, apply batch, set
`onboarding_state.sandbox_workspace_id` + semver); (3) the workspace-switcher "Hammerbarn Demo"
entry resolving to the caller's own sandbox, labelled "Demo — fictional data", with the
Practice-mode banner rendered on every demo screen; (4) Build/Automate areas feature-flagged off
with "Coming soon" (phase tags, TASK-003 registry); (5) **the three isolation release-gate
tests**. Reset is TASK-005. Exercise writes are TASK-009.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-004-01 | WHERE a tenant is provisioned, WHEN a user opens the workspace switcher THE SYSTEM SHALL present one "Hammerbarn Demo" entry labelled "Demo — fictional data" with no setup, resolving to the caller's own sandbox (E1-S1). |
| AC-004-02 | WHEN a user first opens the demo THE SYSTEM SHALL lazy-fork: create a sandbox workspace, apply the pinned seed batch (CE-WRITE-1 `target=draft`, demo service principal), and set the state pointer — target ≤ 10 s p95; a second open SHALL reuse the existing sandbox. |
| AC-004-03 | IF fork fails at any step THEN THE SYSTEM SHALL leave `sandbox_workspace_id` NULL, surface retry, and never present a half-seeded sandbox. |
| AC-004-04 | WHEN any demo screen renders in the sandbox THE SYSTEM SHALL display the "Practice mode" banner (E1-S3); WHEN the area's engine has not shipped THE SYSTEM SHALL render it feature-flagged off with "Coming soon" — never broken/empty. |
| AC-004-05 | **(Boundary 1)** WHEN a user-A principal queries or writes THE SYSTEM SHALL return zero triples from and reject writes (403) to user-B's sandbox. |
| AC-004-06 | **(Boundary 2)** WHEN a non-content-admin identity writes against the canonical template THE SYSTEM SHALL reject 403 AND a PLAT-AUDIT-1 entry SHALL be recorded — both asserted. |
| AC-004-07 | **(Boundary 3)** WHEN an unscoped sandbox query is issued under a tenant-A / user-A JWT THE SYSTEM SHALL return zero tenant-B and zero other-user triples (PRD §2.4 pinned test). |
| AC-004-08 | WHEN the demo renders in the sandbox THE SYSTEM SHALL source content via CE-READ-1 (`?version=latest` semantics on the sandbox draft) and the Explorer canvas via GE-CANVAS-1 — initial render ≤ 3 s p95 on subsequent opens. |

## API Contracts

Consumes `CE-WRITE-1` (batch apply — fork), `CE-READ-1` (render + verification ASKs),
`CE-VERSION-1` (template publish/pin), `GE-CANVAS-1` (canvas embed), `PLAT-IDENTITY-1`
(demo service principal; caller identity), `PLAT-SETTINGS-1` machinery (workspace CRUD +
permissions — flagged contract gap, ADR-002), `PLAT-AUDIT-1` (rejection audit assertion).
Engine-internal: `POST /api/onboarding/sandbox` (idempotent ensure-mine).

## Diagram

architecture.md §Level 3 (`provision`, `guard` components); ADR-002 boundary table;
business-process.md first two flows.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Sandbox-as-workspace; batch fork; tenant-local template | Zero CE changes; no graph crosses a tenant boundary; existing 403 machinery | ADR-002 |
| Lazy fork at first access, not registration | Nobody pays fork cost who never opens the demo | EPIC-001 seed-lifecycle |
| Isolation tests written in this task, not deferred | They gate Gate 1; the boundary owner ships the proof | roadmap HITL gates |
| Template hidden from non-admin switcher | One demo entry per user; canonical is admin plumbing | ADR-002 §2 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Integration | Lazy fork happy path + reuse + ≤ 10 s timing | AC-004-02 |
| Integration | Induced failure at each fork step ⇒ NULL pointer + retryable | AC-004-03 |
| Integration | `test_sandbox_per_user_isolation` (release gate) | AC-004-05 |
| Integration | `test_canonical_write_403_audited` (release gate) | AC-004-06 |
| Integration | `test_cross_tenant_zero_leak` (release gate) | AC-004-07 |
| E2E | Switcher entry, label, banner, "Coming soon" areas, seeded render | AC-004-01/04/08 |

## Dependencies

- **blocked_by**: TASK-001 (state pointer), TASK-002 (batch artefact + apply path)
- **unlocks**: TASK-005 (reset), TASK-009 (exercises write into the sandbox)

## Cost Estimate

**L** — provisioning is orchestration over existing machinery, but the three release-gate tests
must be airtight and the failure-path matrix (AC-004-03) is real work.

## DoR Checklist

- [ ] ADR-002 approved (topology is THE security decision)
- [ ] TASK-002's batch artefact + `--verify` available
- [ ] Platform workspace CRUD + permission model confirmed reachable from the backend module
- [ ] Demo service principal minted via PLAT-IDENTITY-1

## DoD Checklist

- [ ] All ACs pass; the three boundary tests are in the release-gate suite and green
- [ ] Fork failure matrix covered; no half-seeded sandbox path exists
- [ ] Banner + label rendered from design tokens; `ui_verify` gate passes
- [ ] PLAT-AUDIT-1 assertion uses the audit read surface, not log grepping
- [ ] Coverage ≥ 80%, mutation ≥ 60% on provisioner module

## Implementation Hints

The fork sequence is: create workspace → apply batch → verify (TASK-002 `--verify` ASK counts)
→ THEN set the pointer — pointer-last is what makes AC-004-03 trivial. For boundary tests, seed
two tenants × two users with minimal synthetic batches (fast, unambiguous foreign-triple
assertions — testing-strategy.md §5). The Practice-mode banner should key off "current workspace
is a sandbox" from the bootstrap state read, not a route heuristic.

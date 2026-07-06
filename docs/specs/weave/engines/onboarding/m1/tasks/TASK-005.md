---
type: Task
title: "Task: TASK-005 — Reset Demo: blue/green re-fork with known-state guarantee"
description: "The explicit 'Reset demo' action: confirm dialog (with in-progress-exercise
  warning), blue/green workspace swap to the latest canonical batch, exercise-flag clearing,
  activation preservation, and the never-partial failure contract."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-001
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-004"]
unlocks: ["TASK-015"]
adr_refs: [ADR-002, ADR-003]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) · Flow:
[business-process.md](../../tech-spec/business-process.md) §Reset Demo

## Story

As a new user, I want an explicit "Reset demo" button that restores my sandbox to the original
Hammerbarn state, so I can start practice over — without ever losing work to a timer, and
without ever landing in a half-reset sandbox.

## Scope Note

Backend reset endpoint + SPA button/dialog. Blue/green: create fresh workspace → apply latest
batch → atomic swap of `sandbox_workspace_id` + `sandbox_batch_semver` and delete of the user's
`exercise_completion` rows (one transaction) → delete old workspace (best-effort, orphan-swept).
`activation` rows are never touched. Reset is never automatic — button + confirm only. Uses
TASK-004's provisioning path verbatim (one fork implementation, two callers).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-005-01 | WHEN the user clicks "Reset demo" THE SYSTEM SHALL require confirmation; IF an exercise is in progress THEN THE SYSTEM SHALL warn that it will be abandoned before confirming (E1-S2). |
| AC-005-02 | WHEN reset is confirmed THE SYSTEM SHALL restore the sandbox to the latest canonical batch within a default 30 s (tunable) target and update `sandbox_batch_semver` to it. |
| AC-005-03 | WHEN reset succeeds THE SYSTEM SHALL clear the user's `exercise_completion` rows (exercises re-earnable) and SHALL NOT delete any `activation` row (lifetime milestones, ADR-003). |
| AC-005-04 | IF reset fails or exceeds the target at any step THEN THE SYSTEM SHALL show retry + an error toast and leave the sandbox fully old (pointer untouched) — never partial (E1-S2 failure mode). |
| AC-005-05 | WHEN reset completes THE SYSTEM SHALL never have auto-fired — no timer or navigation event triggers it (decision E1); the only entry point is the explicit endpoint behind the button. |
| AC-005-06 | WHEN old-workspace deletion fails after a successful swap THE SYSTEM SHALL log the orphan for sweep; user-visible state SHALL already be correct. |

## API Contracts

Consumes `CE-WRITE-1` (batch apply into the new workspace), `PLAT-SETTINGS-1` machinery
(workspace create/delete). Engine-internal: `POST /api/onboarding/sandbox/reset`.

## Diagram

business-process.md §Reset Demo (stateDiagram — this task implements every transition).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Blue/green swap, pointer-last | Fully-old-or-fully-new falls out of ordering, no cleanup logic on failure | ADR-002 §4 |
| Clear exercises, preserve activation | Re-earnable practice vs lifetime milestone | EPIC-004 epic AC / ADR-003 |
| Reuse TASK-004 provisioner | One fork implementation; reset is fork + swap | ADR-002 |
| Manual only, confirm always | Locked decision E1 (no auto-reset ever) | PRD §2.7 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Integration | `test_reset_known_state` (release gate): induced failure at each step ⇒ pointer consistent | AC-005-04 |
| Integration | Success clears exercise flags, preserves activation, bumps semver | AC-005-02/03 |
| Integration | Orphan on delete failure logged; state correct | AC-005-06 |
| Unit | No non-endpoint code path calls reset (import/reference assertion) | AC-005-05 |
| E2E | Edit → reset → canonical restored; in-progress-exercise warning shown | AC-005-01/02 |

## Dependencies

- **blocked_by**: TASK-004 (provisioning path + sandbox existence)
- **unlocks**: TASK-015 (persistence+reset E2E in the exit suite)

## Cost Estimate

**S** — the provisioner exists; this is the swap transaction, the dialog, and the failure
matrix.

## DoR Checklist

- [ ] TASK-004 merged (provisioner callable)
- [ ] ADR-002 §4 (blue/green) and ADR-003 (activation preservation) approved
- [ ] Reset-op target (30 s default) registered as a tunable

## DoD Checklist

- [ ] All ACs pass; `test_reset_known_state` in the release-gate suite
- [ ] Swap + flag-clear proven single-transaction (no window where new pointer + old flags mix)
- [ ] Dialog copy from i18n keys; tokens only; `ui_verify` passes
- [ ] Coverage ≥ 80%, mutation ≥ 60% on the reset manager

## Implementation Hints

The swap transaction is Postgres-side (pointer + `DELETE FROM exercise_completion WHERE …`);
the graph work happens before it, the old-workspace delete after it. Surface reset progress in
the dialog (fork can take seconds) — poll the endpoint's job status rather than holding the
request open past a gateway timeout. <!-- ponytail: sync endpoint + client poll; a job table
only if reset ever exceeds request timeouts in practice -->

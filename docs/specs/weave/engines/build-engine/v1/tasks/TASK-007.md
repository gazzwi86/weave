---
type: Task
title: "Task: TASK-007 — Ontology Pin Upgrade (FR-012): CE-DIFF-1 Diff + Explicit Confirm"
description: "Pin-diff proxy endpoint (nodes+edges since the project's pinned CE version),
  explicit-confirmation upgrade endpoint with audit, and the settings-tab upgrade dialog
  wired to the M2 staleness indicator."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-005]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-007.md
---

# Task: TASK-007 — Ontology Pin Upgrade (FR-012): CE-DIFF-1 Diff + Explicit Confirm

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** technical architect
**I want** to see exactly what changed in the ontology since my project's pin, and upgrade
only on explicit confirmation
**So that** a pin upgrade is an informed decision, never a surprise re-grounding

> **FRs covered:** FR-012. Builds on FR-036 (M2 staleness indicator — the trigger surface)
> and `CE-DIFF-1` (nodes+edges diff between version IRIs).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/projects/{id}/pin-diff` is called, THE SYSTEM SHALL return the CE-DIFF-1 delta between `pinned_graph_version_iri` and the newest published version — the triple delta plus the response's ordered `versions: [{version_iri, breaking}]` span passed through verbatim (CE computes `breaking` at publish, covering function-signature AND shape/kind changes; Build never derives it) | `should return pin diff between pinned and latest version` |
| AC-2 | WHEN CE is unreachable during diff, THE SYSTEM SHALL return a named "diff unavailable" error — the UI renders it as such, never an empty diff (an empty diff reads as "no changes", a false-safe signal) | `should return diff unavailable not empty diff when CE unreachable` |
| AC-3 | WHEN `POST /api/projects/{id}/pin-upgrade` is called, THE SYSTEM SHALL require the request to echo the exact target `version_iri` shown in the diff (the explicit confirmation) and reject a mismatch with 409 | `should reject pin upgrade when confirmed version mismatches latest` |
| AC-4 | WHEN the upgrade commits, THE SYSTEM SHALL update `pinned_graph_version_iri`, write a PLAT-AUDIT-1 entry (old pin, new pin, principal), and the staleness indicator SHALL read current on next fetch | `should upgrade pin atomically with audit entry` |
| AC-5 | WHEN the upgrade dialog renders a diff containing `breaking: true` versions, THE SYSTEM SHALL visually flag the breaking span and require a second acknowledgement affordance before enabling confirm | `should require breaking acknowledgement before confirm` |
| AC-6 | WHEN a non-admin attempts the upgrade, THE SYSTEM SHALL 403 + audit (SETTINGS guard class) | covered by Role Guard suite (TASK-002); route registration asserted here |

## Implementation

### Pseudocode

```
GET /pin-diff (guard: read — any company (tenant) member):
    latest = ce_client.current_version()
    diff = ce_client.diff(project.pinned_graph_version_iri, latest)   # CE-DIFF-1
    return {from, to: latest, nodes, edges,
            versions: diff.versions}   # ordered [{version_iri, breaking}] — CE-DIFF-1
                                       # passthrough; same source as the M2 sdk_breaking_ack check
    on CEUnreachable -> 503 {error: "diff_unavailable"}               # AC-2

POST /pin-upgrade (guard: SETTINGS):
    if body.confirm_version_iri != ce_client.current_version(): raise 409   # AC-3
    async with tx:                                                     # AC-4
        repo.projects.update_pin(project_id, new=body.confirm_version_iri)
        emit_audit(pin_upgrade, old, new, ctx.principal_iri)           # in-tx outbox per
                                                                       # existing emitter pattern
UI (settings governance tab):
    StalenessBadge (existing FR-036 read) -> "Review upgrade" opens PinDiffDialog
    PinDiffDialog: node/edge delta list; breaking span -> AckCheckbox gates Confirm  # AC-5
    Confirm posts {confirm_version_iri: diff.to}
```

### API Contracts

`GET /api/projects/{id}/pin-diff` p95 ≤ 2 s (CE-bound; v1-delta §3) ·
`POST /api/projects/{id}/pin-upgrade` p95 ≤ 800 ms. Errors: 403, 404, 409 (confirm
mismatch), 503 (diff unavailable), 500. Consumes `CE-DIFF-1` + `CE-VERSION-1` via `ce_client`
only (ADR-001 — no raw SPARQL), `PLAT-AUDIT-1` emitter.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Pin Upgrade → ce_client path |
| Contract | `../../../../contracts.md` | §CE-DIFF-1 (breaking-span) | Diff shape + ordered `versions[].breaking` span — the one contracted breakingness source (`any(v.breaking)` in one call) |
| M2 staleness | `../../tech-spec/m2-delta.md` | §3.5 | The indicator this flow hangs off |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Confirmation = echo the target version IRI | AC-3 | Race-proof: a version published mid-review invalidates the confirm (409) instead of upgrading past what was reviewed |
| Empty diff is never synthesised from an error | AC-2 | Mirrors the staleness "unknown" honesty rule; CE outage must look like an outage |
| Breaking span needs a second acknowledgement | AC-5 | Same posture as the SDK `sdk_breaking_ack` gate (M2) — breaking is never one-click |
| Upgrade + audit in one transaction (outbox) | AC-4 | No pin change without its audit trail |

## Test Requirements

### Unit Tests (minimum 3)

- `should reject pin upgrade when confirmed version mismatches latest`
- `should return diff unavailable not empty diff when CE unreachable` (ce_client stub raising)
- `should require breaking acknowledgement before confirm` (dialog component test)

### Integration Tests (minimum 2)

- `should return pin diff between pinned and latest version` (CE stub with fixture versions)
- `should upgrade pin atomically with audit entry` (asserts row + audit stub payload — Law B)

### E2E Tests (Playwright, minimum 1)

- `should review diff and upgrade pin end to end` (staleness badge → dialog → confirm →
  badge reads current; `pinned_graph_version_iri` asserted server-side)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should return pin diff between pinned and latest version` |
| AC-2 | Unit | `should return diff unavailable not empty diff when CE unreachable` |
| AC-3 | Unit | `should reject pin upgrade when confirmed version mismatches latest` |
| AC-4 | Integration + E2E | `should upgrade pin atomically with audit entry` / E2E flow |
| AC-5 | Unit | `should require breaking acknowledgement before confirm` |
| AC-6 | Integration | Role Guard suite; route registration check |

## Dependencies

- **blocked_by:** [TASK-005] (settings tab + guard-wired router family)
- **unlocks:** []
- **External prerequisites:** `CE-DIFF-1` endpoint (live since CE M2); FR-036 staleness read
  (live since Build M2); `ce_client` (M1)

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
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. Playwright E2E with backend assertion)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `confirm` greppable in the pin-upgrade handler (invariants.md verify-by)
- [ ] Dialog passes ui_verify; Lighthouse targets hold on the settings route
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- `ce_client` already wraps CE-VERSION-1/CE-DIFF-1 from M1/M2 — this task adds routes + UI,
  not client methods (check before writing new ones).
- The diff payload can be large on a stale pin; render nodes/edges as virtualised lists and
  summarise counts up top — the p95 budget is on the API, the dialog must not choke on 1k rows.
- Reuse the M2 `sdk_breaking_ack` visual language for the breaking span flag (consistency:
  breaking looks the same everywhere).
- Audit emit uses the existing in-tx outbox pattern from the M1 emitter — do not emit
  post-commit fire-and-forget for a governance change.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

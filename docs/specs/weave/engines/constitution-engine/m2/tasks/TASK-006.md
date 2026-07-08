---
type: Task
title: "Task: TASK-006 — Rules & Policies Screen + Full Validation Report API"
description: "Browse all modelled rules with live violation coverage and a 'validation pending'
  state (E5-S2 browse half), plus GET /api/validate returning the full tenant-scoped SHACL report
  (FR-027)."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-005
milestone: M2
created: 2026-07-08
blocked_by: ["TASK-005"]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-005, FR-027)
Contracts: [contracts.md](../../../../contracts.md) · M2 delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §3, §7, §9

## Story

As a compliance officer, I need to see every modelled rule and which entities currently violate
it — with an honest "validation pending" state instead of stale numbers — so I can prove coverage
to an auditor from the screen, not from tribal knowledge.

## Scope

Rules & Policies screen (rule list + per-rule violation coverage + severity display incl.
`sh:Info`) and the `GET /api/validate` full-report endpoint (FR-027). Scheduled self-audit
(E5-S2 scheduling + PLAT-NOTIFY-1) is Phase 4 — OUT. UI-bearing: tokens + `ui_verify` apply.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-006-01 | WHEN `GET /api/validate?version=latest\|{iri}\|draft` is called THE SYSTEM SHALL return the full tenant-scoped SHACL report — violations, warnings, info — each entry carrying shape IRI, focus node, path, message, severity. |
| AC-006-02 | WHEN `GET /api/validate` is called with an unknown version THE SYSTEM SHALL return 404; without a JWT, 401 (FR-027 error floor). |
| AC-006-03 | WHEN the rules screen lists shapes THE SYSTEM SHALL show framework AND tenant shapes with severity, description, and the count + list of entities currently in violation. |
| AC-006-04 | WHEN validation has not yet run for the current draft state THE SYSTEM SHALL show "validation pending" — never stale counts and never an empty state readable as "no violations". |
| AC-006-05 | WHEN a rule row is expanded THE SYSTEM SHALL list violating entities with links to their resource views. |
| AC-006-06 | WHEN the full report is requested THE SYSTEM SHALL respond p95 ≤ 2 s at the 100k store with governance shapes loaded (m2-delta §9). |
| AC-006-07 | WHEN the rules page renders THE SYSTEM SHALL meet Lighthouse ≥ 90 perf / ≥ 95 a11y with design tokens only. |

## Pseudocode

```text
GET /api/validate?version=...:
    graph  = resolve(version)               # M1 version-resolution helper
    shapes = load(framework ∪ tenant)       # TASK-005 loader, same cache
    report = pyshacl(graph, shapes, inference='none')
    return {results: [{shape_iri, focus_node, path, message,
                       severity: Violation|Warning|Info}],
            ran_at, version_resolved}

RulesPage:
    list  = shapes + per-shape violation counts (from latest report for current state)
    state = report.ran_at matches current draft hash ? counts : "validation pending"
    expand(rule) -> violating entities -> links to resource view
```

## API Contracts

- **NEW endpoint** `GET /api/validate` (FR-027; CE-internal surface, not a `CE-*` inter-engine
  contract). Errors: 401, 404, 500. p95 ≤ 2 s full report.
- Reads for the screen: `GET /api/validate` + CE-READ-1 SPARQL for shape metadata.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Governance shapes design | [m2-delta.md](../../tech-spec/m2-delta.md) §3 | Shape set + hash the pending-state check keys on |
| Validation report spec | [m2-delta.md](../../tech-spec/m2-delta.md) §7 | Report scope and error floor |
| M1 validation pipeline | [architecture.md](../../tech-spec/architecture.md) | The validator this endpoint wraps for whole-graph runs |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| "Validation pending" keyed on draft hash | The report is stamped with the shapes+data state it ran against; mismatch = pending. Honest-state is an epic AC ("never stale or empty coverage") | EPIC-005 E5-S2 AC (failure), m2-delta §3 |
| Whole-graph validation is on-demand (this endpoint), not continuous | Per-commit validation already gates writes; a background revalidator is Phase 4 (scheduled self-audit). On-demand keeps M2 lean | roadmap carry, ponytail: add scheduling in Phase 4 only |
| `sh:Info` displayed, not hidden | EPIC-005 AC names Info explicitly; auditors read advisory severity too | EPIC-005 E5-S2 AC |

## Test Requirements

Minimum: 3 unit, 4 integration, 1 E2E.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should map pyshacl results to the report schema incl. Info severity | AC-006-01 |
| Unit | should compute pending state when report hash ≠ current draft hash | AC-006-04 |
| Unit | should group violations by shape with counts | AC-006-03 |
| Integration | should return full report for seeded graph with known violations (all 3 severities) | AC-006-01 |
| Integration | should 404 unknown version and 401 missing JWT | AC-006-02 |
| Integration | should include tenant shapes (TASK-005 fixture) in the report | AC-006-03 |
| Perf | locust: full report p95 ≤ 2 s @ 100k + governance shapes | AC-006-06 |
| E2E | officer opens rules screen post-commit → pending → report runs → violating entity linked and opened | AC-006-03..05 |
| Gate | axe-core + Lighthouse on rules page | AC-006-07 |

## Dependencies

- **blocked_by**: TASK-005 (tenant shapes + loader + hash this screen keys on)
- **unlocks**: none (leaf; CE-METRICS-1 in TASK-007 reads validation results independently)

## Cost Estimate

**M** — est. **400k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). One endpoint wrapping the
existing validator, one screen, one perf case.

## DoR Checklist

- [x] Report shape + error floor pinned (m2-delta §7)
- [x] Pending-state semantics pinned (draft-hash keyed)
- [x] p95 pinned (≤ 2 s, m2-delta §9)
- [ ] TASK-005 merged
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + perf + E2E)
- [ ] "Validation pending" verified: no path renders zero-counts without a matching report
- [ ] `ui_verify` gate passed; Lighthouse budgets met
- [ ] E2E asserts backend state (report ran; entity link resolves) — Law B
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Wrap the existing per-commit validator for whole-graph runs — same pyshacl config
  (`inference='none'`), same shape loader (TASK-005). Do not instantiate a second validator
  configuration; drift between commit-gate and report is an audit bug.
- Report caching: store the last report per (tenant, state-hash) in Aurora or Redis; the screen's
  pending check is then a hash comparison, no re-validation on page load.
- Pitfall: large violation lists — paginate per-rule entity lists (50/page) in the expand call,
  not eagerly in the report payload.

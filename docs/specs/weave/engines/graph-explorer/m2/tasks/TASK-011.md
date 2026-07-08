---
type: Task Brief
title: "Task: TASK-011 — M2 Release-Gate Suite (isolation, a11y, perf, invariants)"
description: "Terminal M2 task: two-tenant cross-surface isolation suite, axe/Lighthouse gates
  on all M2 panels, perf traces for the 300ms/10k budgets, invariants.md verify-by execution,
  and the M2 exit-criteria evidence bundle."
tags: [graph-explorer, arch, task, m2]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-004
milestone: M2
created: 2026-07-08
blocked_by: [TASK-003, TASK-005, TASK-007, TASK-008, TASK-009, TASK-010]
unlocks: []
adr_refs: [ADR-005-impact-traversal-predicate-closure, ADR-006-edit-attribution-principal-iri]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-011 — M2 Release-Gate Suite

## Story

**Epic:** cross-epic (M2 exit gate — [graph-explorer.md §Roadmap M2](../../../graph-explorer.md#m2--fast-follow-editing--overlays--async))
**Status:** Backlog · **Priority:** Must Have (terminal — gates the M2 HITL)

**As the** PO + Tech lead approving the M2 gate
**I want** one suite that proves the milestone-level claims (isolation, accessibility,
performance, invariants) across everything M2 shipped, with an evidence bundle
**So that** the M2 phase-boundary sign-off is a read of artefacts, not a hunt.

Covers the M2 exit criteria's measurable artefacts: cross-tenant isolation test report,
GE-CANVAS-1 conformance report (produced by TASK-010, referenced here), coverage/mutation
numbers, zero-axe evidence.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the two-tenant isolation suite runs (seeded tenants A + B), THE SYSTEM SHALL demonstrate zero tenant-B rows/triples for tenant-A JWTs across EVERY M2 read surface: graph load, resource fetch, diff, versions, coverage_gap, views list, comments fetch, `view:*` layout rows; AND rejection (404) when tenant-A addresses a tenant-B view id. | `test_cross_tenant_isolation_m2` (suite) |
| AC-2 | WHEN the axe-core CI job runs against every M2 panel/dialog (filters, overlays legend, versions, save/library/share, comments, completeness panel, GraphCanvas states), THE SYSTEM SHALL report zero violations on non-canvas UI. | CI `axe-m2` job |
| AC-3 | WHEN the Lighthouse CI job runs on the Explorer route with M2 panels active, THE SYSTEM SHALL meet performance ≥ 90, accessibility ≥ 95, best practices ≥ 90. | CI `lighthouse-explorer` job |
| AC-4 | WHEN the perf-trace job runs at the 10k fixture, THE SYSTEM SHALL evidence: filter/overlay/badge apply ≤ 300 ms p95 (TASK-001/002/008), view save ≤ 800 ms p95 (TASK-006 AC-9 measurement), proxy overheads within m2-delta §4 targets. | CI `perf-m2` job |
| AC-5 | WHEN the invariants job runs, THE SYSTEM SHALL execute every M2 verify-by selector in `tech-spec/invariants.md` (greps + named-test presence), pinning any still-indicative file paths to real ones, and fail on any unmet invariant. | CI `invariants-check` job |
| AC-6 | WHEN the gate bundle builds, THE SYSTEM SHALL emit one artefact directory: isolation report, axe/Lighthouse outputs, perf traces, invariants result, GE-CANVAS-1 conformance report (from TASK-010), coverage + mutation numbers — each file named and dated. | `test_gate_bundle_completeness` |
| AC-7 | WHERE any gate job fails, THE SYSTEM SHALL fail CI loudly; no gate job may be marked continue-on-error (weakening a gate is never a valid fix — git-safety rule). | CI config review + `test_no_continue_on_error_on_gate_jobs` |

## Implementation

### Pseudocode

```
# Two-tenant isolation suite (AC-1) — extends the M1 RLS fixture
fixture: seed tenant A + B with distinguishable data across:
  RDF (CE stub graphs), explorer_layout_positions (incl. view:* rows),
  explorer_saved_views, explorer_comments
for surface in [graphLoad, resourceFetch, diff, versions, coverageGap,
                viewsList, commentsFetch, layoutRead]:
  resultA = surface(jwtA)
  assert none of resultA references tenant-B markers
assert GET /api/views/{B_view_id} as A → 404
assert GraphCanvas mounted under A with B's filterByIri → empty (rule 6 cross-check)

# Invariants runner (AC-5) — small script, reads invariants.md, executes each verify-by
for line in parse(invariants.md, section="M2 delta") + section("M1"):
  run(line.verify_by)   # grep pattern | test-name presence in suite manifests
  record(pass/fail)
# indicative paths: resolve against the real tree, update invariants.md selectors in this PR

# Gate bundle (AC-6)
artefacts/m2-gate/{isolation-report.json, axe/, lighthouse/, perf/, invariants.json,
                   ge-canvas-1-conformance.json (copied), coverage.xml, mutation.json}
```

### API Contracts

No new endpoints. This task consumes every surface previous tasks built; all against stubs +
local Postgres (Law F — the "Pre-AWS-deploy" HITL is a separate later gate).

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Quality table | `../../tech-spec/architecture.md` | Quality Attributes | M1 gate rows this suite extends to M2 |
| Delta targets | `../../tech-spec/m2-delta.md` | §4–§7 | The budgets and testing delta this suite evidences |
| Invariants | `../../tech-spec/invariants.md` | all | The checklist AC-5 executes |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Isolation is a release gate, tested cross-surface in one suite | graph-explorer.md §2.2 required test | One fixture, eight surfaces — not eight bespoke fixtures |
| Invariants get an executable runner, not manual review | Arch Law 10; invariants.md header | The runner also PINS indicative paths — invariants.md leaves this task with real selectors |
| Gate jobs may never be continue-on-error | git-safety.md (weakening a gate) | AC-7 asserts it mechanically |
| Evidence bundle is one directory artefact | M2 exit criteria "measurable artefacts" | The HITL approver reads one place |

## Test Requirements

### Suite composition (this task IS tests; minimums are suite-level)

- Isolation: minimum 9 assertions (8 surfaces + view-id rejection) — `test_cross_tenant_isolation_m2`
- Invariants: every M2 line in invariants.md executed; every M1 line re-executed
- Perf: 3 trace groups (client budgets, view save, proxy overheads)
- Meta: `test_gate_bundle_completeness`, `test_no_continue_on_error_on_gate_jobs`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration suite | isolation suite |
| AC-2 | CI job | axe-m2 |
| AC-3 | CI job | lighthouse-explorer |
| AC-4 | CI job | perf-m2 |
| AC-5 | CI job + script | invariants-check |
| AC-6 | Unit | bundle-completeness test |
| AC-7 | Unit + review | no-continue-on-error test |

## Dependencies

- **blocked_by:** [TASK-003, TASK-005, TASK-007, TASK-008, TASK-009, TASK-010] (terminal —
  everything M2 ships is in scope; TASK-001/002/004/006 are transitively covered via these)
- **unlocks:** M2 phase-boundary HITL (PO + Tech lead) and, with it, the post-v1 planning gate
- **External:** CI capacity for the 10k fixture jobs; the M1 gate suite (this extends it, not
  replaces it — M1 jobs keep running).

## Cost Estimate

- **Complexity:** M-L (breadth over novelty; the invariants runner is the only new machine)
- **Estimated tokens:** ~14k input, ~8k output (claude-sonnet-5)
- **Estimated cost:** ~$0.46

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (none new; consumption-only stated)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (terminal position in DAG)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met; all gate jobs green on the M2 integration branch
- [ ] invariants.md selectors pinned to real paths (committed in this PR)
- [ ] Gate evidence bundle produced and linked in the PR description
- [ ] Coverage ≥ 80%; mutation ≥ 60% (whole M2 scope — the numbers go IN the bundle)
- [ ] Lint passes; complexity within thresholds
- [ ] Conventional commit(s); PR references this task and the M2 gate
- [ ] No implementation beyond AC (no dashboards, no trend graphs — the bundle is files)

## Implementation Hints

- Reuse the M1 two-tenant RLS fixture and extend its seed — do not write a second fixture
  (ladder rung 2; drift between fixtures is how isolation tests rot).
- The invariants runner is a ~50-line script (read markdown, extract `verify-by:` lines, shell
  out) — `# ponytail: markdown-parse by regex; a structured format if invariants grow past ~40`.
- Perf traces: reuse the OQ-01 harness timing hooks (M1) for client budgets; `locust` (already
  in the testing strategy) for the view-save p95.
- axe on GraphCanvas states: mount the component in the three states (empty/error/loading) in
  a bare route — the standalone-mount work from TASK-010 gives you this for free.
- If any budget fails: the fix goes in the owning task's code with this suite as the detector —
  never tune the budget here without an architect amendment (gate-weakening rule).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

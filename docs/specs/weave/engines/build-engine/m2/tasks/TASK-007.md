---
type: Task
title: "Task: TASK-007 — Full QA Category Suite (E12-S3, FR-054)"
description: "Implement the full QA suite the phase-gate ceremony invokes: nine categories
  (AC↔test mapping, coverage, complexity, lint, a11y, perf-vs-SLO, browser+backend assertion,
  delta mutation, edge-case extension), each producing a category verdict; unavailable
  category = NOT VERIFIED = suite fail."
tags: [build-engine, arch, task, m2]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-012
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: [TASK-008]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m2/tasks/TASK-007.md
---

# Task: TASK-007 — Full QA Category Suite (E12-S3, FR-054)

## Story

**Epic:** [EPIC-012 — Quality Gates & Spec-Coverage](../../../build-engine.md#epic-012)
**Status:** Backlog · **Priority:** Must Have

**As a** phase-gate ceremony
**I want** a QA suite that runs every applicable category against the generated project and
never silently skips one
**So that** "QA passed" means every category was actually evaluated — a category that could not
run is a failure, not a footnote

> **FRs covered:** FR-054. This suite is a callable the ceremony (TASK-008) invokes; it extends
> the M1 DoD gate runner (FR-047 — QA agent self-runs commands, unrunnable = NOT VERIFIED)
> from 5 commands to 9 categories with per-category applicability rules.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the suite runs, THE SYSTEM SHALL evaluate all applicable categories — `ac_test_mapping`, `coverage` (≥ 80%), `complexity` (Law E thresholds), `lint`, `a11y` (axe / WCAG 2.1 AA), `perf` (vs project SLOs), `browser_backend` (browser automation + backend-state assertion), `delta_mutation` (≥ 70%), `edge_case_extension` — and record one `gate_results` row per category | `should record one gate row per applicable category` |
| AC-2 | WHEN a category's tool cannot run or is absent, THE SYSTEM SHALL record that category `not_verified` and the overall suite FAIL — never skipped, never warned-and-passed | `should record not_verified and fail suite when qa category unavailable` |
| AC-3 | WHEN the generated project has no UI, THE SYSTEM SHALL mark `a11y` and `browser_backend` `n/a` (with reason) — `n/a` with a recorded reason does not fail the suite; only `not_verified` does | `should mark a11y n/a with reason for headless project` |
| AC-4 | WHEN `ac_test_mapping` runs, THE SYSTEM SHALL verify every AC in the project's task briefs maps to a named test present in the test tree; an unmapped AC is a category failure listing the AC IDs | `should fail ac mapping listing unmapped ac ids` |
| AC-5 | WHEN `browser_backend` runs for a UI project, THE SYSTEM SHALL execute the Playwright lane AND assert backend state changed (Law B) — a UI-only pass without a backend assertion is a category failure | `should fail browser category without backend assertion` |
| AC-6 | WHEN all applicable categories pass, THE SYSTEM SHALL return an aggregate PASS with the per-category evidence bundle for the ceremony record | `should aggregate pass with evidence bundle` |

## Implementation

### Pseudocode

```
CATEGORIES = [   # (name, applicability, runner)
  ("ac_test_mapping",    always,       run_ac_mapping),
  ("coverage",           always,       cmd("pytest --cov --cov-fail-under=80 / vitest --coverage")),
  ("complexity",         always,       run_complexity_budget),      # Law E thresholds
  ("lint",               always,       cmd("ruff check / eslint")),
  ("a11y",               ui_only,      cmd("playwright + axe-core, WCAG 2.1 AA")),
  ("perf",               has_slo,      run_perf_vs_slo),
  ("browser_backend",    ui_only,      run_browser_with_backend_assert),   # AC-5
  ("delta_mutation",     always,       cmd("mutmut/Stryker delta ≥ 70%")),
  ("edge_case_extension",always,       run_edge_case_extension),
]

function run_full_qa(project, run):
  results = []
  for (name, applicable, runner) in CATEGORIES:
    if not applicable(project):
      results.append((name, "n_a", {"reason": why_not(project, name)}))   # AC-3
      continue
    try:
      verdict, evidence = runner(project)          # QA agent self-runs (FR-047 pattern)
    except ToolUnavailable as e:
      verdict, evidence = "not_verified", {"tool": e.tool}                # AC-2
    results.append((name, verdict, evidence))
    record_gate(run, f"qa_{name}", verdict, evidence)                     # AC-1
  overall = PASS if all(v in ("passed","n_a") for (_, v, _) in results) else FAIL
  record_gate(run, "qa_full", overall, {"categories": summarise(results)})
  return overall, results
```

### API Contracts

No public endpoint — invoked by the ceremony (TASK-008) and available to the orchestrator.
Suite budget: within the ceremony's ≤ 10 min p95 ex-human (m2-delta §7); long lanes (mutation,
Playwright) stream progress to the run log.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Ceremony flow | `../../tech-spec/m2-delta.md` | §3.3 | Suite is ceremony step 3 |
| M1 baseline | `../../tech-spec/architecture.md` | §Level 3 | DoD gate runner this extends (FR-047 semantics) |
| Testing | `../../tech-spec/testing-strategy.md` | whole file | Framework/tooling conventions per language |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| `not_verified` ≠ `n_a` | FR-054 + this brief | Unavailable tool fails; inapplicable-with-reason doesn't — the distinction is the honesty rule |
| Extends the FR-047 runner pattern | M1 TASK-007 | Same self-run/no-simulation discipline; categories are data, not bespoke code paths |
| One gate row per category + one aggregate | m2-delta §4 | `qa_*` kinds in the open enum; ceremony consumes the aggregate, audit reads categories |
| Applicability is project-derived, not config | this brief | `ui_only` = project has UI packages; `has_slo` = SLOs declared in spec; no manual toggles to forget |
| Browser lane must assert backend state | Plugin Law B | Playwright test that only reads the DOM fails the category |

## Test Requirements

### Unit Tests (minimum 5)

- `should record not_verified and fail suite when qa category unavailable`
- `should mark a11y n/a with reason for headless project`
- `should fail ac mapping listing unmapped ac ids`
- `should fail browser category without backend assertion` (evidence lacks backend assert)
- `should aggregate pass with evidence bundle`

### Integration Tests (minimum 3)

- `should record one gate row per applicable category` (fixture project, stub runners)
- `should run real coverage and lint runners against fixture project` (small seeded repo)
- `should stream long-lane progress to run log` (stub mutation lane)

### E2E Tests

The suite itself IS the E2E machinery for generated projects; its own E2E proof is the
ceremony lane in TASK-008 (fixture app through ceremony incl. this suite).

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should record one gate row per applicable category` |
| AC-2 | Unit | `should record not_verified and fail suite when qa category unavailable` |
| AC-3 | Unit | `should mark a11y n/a with reason for headless project` |
| AC-4 | Unit | `should fail ac mapping listing unmapped ac ids` |
| AC-5 | Unit | `should fail browser category without backend assertion` |
| AC-6 | Unit | `should aggregate pass with evidence bundle` |

## Dependencies

- **blocked_by:** []
- **unlocks:** [TASK-008]
- **External prerequisites:** QA tooling in the agent execution image (ruff/eslint, pytest/vitest,
  mutmut/Stryker, Playwright + axe-core); M1 DoD runner (FR-047) as the extension seam

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~18k input, ~9k output
- **Estimated cost:** ~$0.65 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided (categories as data table)
- [x] API contracts defined (internal callable; budget stated)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `not_verified` greppable in suite module (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-012

## Implementation Hints

- Keep `CATEGORIES` a module-level data table — the M1 DoD runner already proves the
  loop-over-commands shape; nine categories should not mean nine functionsful of orchestration.
- `edge_case_extension`: QA agent proposes additional edge-case tests for uncovered boundaries
  and runs them — this is the one LLM-involved category; its verdict is based on the *tests
  executing*, not on model opinion (failing proposed test = finding, not category fail unless
  it reveals an AC violation).
- `run_perf_vs_slo`: SLOs come from the generated project's spec record; absent SLOs ⇒ `has_slo`
  false ⇒ `n_a` with reason — do not invent default SLOs.
- Evidence bundles go in the `gate_results.failing_checks` JSONB (naming kept from M1 even for
  pass evidence) — truncate tool output to 2k chars per category, full output to the run log.
- a11y lane: axe-core via Playwright fixture, WCAG 2.1 AA ruleset only — do not enable
  experimental rules (noise fails ceremonies).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

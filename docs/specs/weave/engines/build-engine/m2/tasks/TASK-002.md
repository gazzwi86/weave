---
type: Task
title: "Task: TASK-002 — CE-BRAND-1 Conformance Gate as Sixth Safety Gate (E8-S1, FR-029 M2)"
description: "Wire the brand-conformance gate into the M1 atomic safety-gate pipeline: fetch
  CE-BRAND-1 tokens + VoiceRules, score generated output, hard-fail on any critical rule,
  pass bar score ≥ 0.90 (PLAT-SETTINGS-1 tunable). M2 exit criterion 1."
tags: [build-engine, arch, task, m2]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-008
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m2/tasks/TASK-002.md
---

# Task: TASK-002 — CE-BRAND-1 Conformance Gate as Sixth Safety Gate (E8-S1, FR-029 M2)

## Story

**Epic:** [EPIC-008 — App Generation](../../../build-engine.md#epic-008)
**Status:** Backlog · **Priority:** Must Have

**As a** brand owner
**I want** every generated artefact scored against our design tokens and voice rules before it
can commit
**So that** nothing off-brand ever lands in a client repo — and a single critical violation
blocks regardless of the aggregate score

> **FRs covered:** FR-029 M2 half (CE-BRAND-1 conformance gate). The five M1 safety gates are
> untouched except for pipeline registration order. Scoring formula is contracts.md §CE-BRAND-1
> — cite, never re-derive. **M2 exit criterion 1.**

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the safety-gate pipeline runs, THE SYSTEM SHALL evaluate the brand gate sixth, after `mutation`, and record a `gate_results` row `gate: "brand"` with `{score, critical_failures, rules_evaluated}` in `failing_checks`-style JSONB | `should run brand gate sixth and record score row` |
| AC-2 | WHEN any `severity: "critical"` VoiceRule fails, THE SYSTEM SHALL fail the brand gate regardless of score — even score 1.0 | `should fail brand gate on one critical rule failure despite score 1.0` |
| AC-3 | WHEN no critical rule fails AND `score = normal_passed / normal_total ≥ pass_bar`, THE SYSTEM SHALL pass the gate; `pass_bar` defaults to 0.90 and resolves via PLAT-SETTINGS-1 (never a hardcoded literal) | `should pass at exactly the configured pass bar` |
| AC-4 | WHEN the brand gate fails, THE SYSTEM SHALL commit nothing — atomicity of the six-gate set is identical to the M1 five-gate behaviour (any failure = nothing committed) | `should commit nothing when brand gate fails after five passes` |
| AC-5 | WHEN CE-BRAND-1 endpoints are unreachable at gate time, THE SYSTEM SHALL record the gate `not_verified` and FAIL it (an unevaluable gate never passes), naming `ce_unavailable` | `should fail closed when CE-BRAND-1 unreachable` |
| AC-6 | WHEN a VoiceRule's `assertion` is not mechanically evaluable by the checker, THE SYSTEM SHALL record that rule `not_evaluable` and count it as failed-normal (or failed-critical if critical) — never silently skipped | `should count not-evaluable rule as failed` |

## Implementation

### Pseudocode

```
function brand_gate(run, workspace):                    # registered 6th in SAFETY_GATES
  try:
    tokens = ce_client.get("/api/brand/tokens")         # closed core; extensions ignored here
    rules  = ce_client.get("/api/brand/voice-rules")
  except CeUnavailable:
    record_gate(run, "brand", "failed", {"reason": "ce_unavailable", "not_verified": true})
    return FAIL                                          # AC-5 — fail closed

  results = [evaluate(rule, run.staging_dir, tokens) for rule in rules]
  #   evaluate → passed | failed | not_evaluable  (not_evaluable counts as failed — AC-6)
  critical_failures = [r for r in results if r.rule.severity == "critical" and r.status != "passed"]
  normal = [r for r in results if r.rule.severity == "normal"]
  score = count(normal, passed) / len(normal) if normal else 1.0

  pass_bar = settings.resolve("build.brand.pass_bar", default=0.90)   # PLAT-SETTINGS-1 (AC-3)
  passed = (not critical_failures) and score >= pass_bar

  record_gate(run, "brand", "passed" if passed else "failed",
              {"score": score, "critical_failures": [r.rule.id for r in critical_failures],
               "rules_evaluated": len(results)})
  return PASS if passed else FAIL   # pipeline atomicity handled by M1 gate runner (AC-4)
```

Token conformance (design-token half): generated UI code is checked against the **closed core**
(`color`, `typography`, `spacing`, `radius`) — ad-hoc hex/px literals in generated output are
findings against the corresponding token rule. Rule evaluation operates on `run.staging_dir`
(pre-commit workspace), same tree the five M1 gates scan.

### API Contracts

No new public endpoint — the gate is internal to the pipeline. Consumes (cite only):

- `GET /api/brand/tokens` — contracts.md §CE-BRAND-1 (closed core + untyped extensions)
- `GET /api/brand/voice-rules` — `[{id, severity: "critical"|"normal", assertion}]`

Gate evaluation adds ≤ 30 s p95 to the pipeline (within the M1 ≤ 10 min full-pipeline budget).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Gate flow | `../../tech-spec/m2-delta.md` | §3.1 | Gate order `secret→sast→type→pkg→mutation→brand`, atomic |
| Component | `../../tech-spec/m2-delta.md` | §2 diagram | Brand Gate → ce_client (no new egress) |
| Data model | `../../tech-spec/data-model.md` | §Gate Results Table | Open `gate` enum gains `brand` |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Scoring formula fixed by contract | [contracts.md §CE-BRAND-1](../../../../contracts.md) | `normal-passed/normal-total`; critical = hard fail; do not invent weighting |
| Gate is 6th, set stays atomic | m2-delta §3.1 | Register in the existing M1 gate runner; no new pipeline mechanics |
| Fail closed on CE outage | invariants.md (M1 fail-closed family) | `not_verified` = FAIL; mirrors FR-047 unrunnable-command rule |
| pass_bar via PLAT-SETTINGS-1 | m2-delta §9 / invariants.md | No `0.90` literal without settings fallback comment |
| Zero normal rules ⇒ score 1.0 | this brief | Empty rule catalogue passes on score but critical rules still checked; edge pinned by test |

## Test Requirements

### Unit Tests (minimum 5)

- `should fail brand gate on one critical rule failure despite score 1.0`
- `should pass at exactly the configured pass bar`
- `should fail just below the configured pass bar`
- `should count not-evaluable rule as failed`
- `should score 1.0 when zero normal rules and no critical failures`

### Integration Tests (minimum 3)

- `should run brand gate sixth and record score row` (fixture run, CE stub)
- `should commit nothing when brand gate fails after five passes` (staging dir intact, no commit)
- `should fail closed when CE-BRAND-1 unreachable` (CE stub down)

### E2E Tests

Covered by the M2 exit-criterion pipeline test (generated fixture app through all six gates) —
lands with TASK-008's ceremony E2E lane; no separate browser E2E here.

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should run brand gate sixth and record score row` |
| AC-2 | Unit | `should fail brand gate on one critical rule failure despite score 1.0` |
| AC-3 | Unit | `should pass at exactly the configured pass bar` |
| AC-4 | Integration | `should commit nothing when brand gate fails after five passes` |
| AC-5 | Integration | `should fail closed when CE-BRAND-1 unreachable` |
| AC-6 | Unit | `should count not-evaluable rule as failed` |

## Dependencies

- **blocked_by:** []
- **unlocks:** []
- **External prerequisites:** CE M2 `GET /api/brand/tokens` + `/api/brand/voice-rules` live
  (committed CE M2 scope); stubbed in all tests (Law F)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~12k input, ~5k output
- **Estimated cost:** ~$0.40 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (consumed contracts cited; no new endpoint)
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
- [ ] No hardcoded `0.90` (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-008

## Implementation Hints

- Register in the M1 gate runner's ordered list — the atomicity/rollback machinery is already
  there (TASK-008 M1); this task adds one gate callable, not pipeline logic.
- `evaluate(rule, ...)`: VoiceRule `assertion` is machine-evaluable by contract; implement a
  small dispatcher over assertion kinds present in the CE fixture catalogue and return
  `not_evaluable` for unknown kinds (AC-6) — do NOT attempt LLM evaluation of prose assertions.
- Token scan: reuse the SAST gate's file-walker for the staging tree; a regex pass for hex
  colours/px literals in UI files is sufficient — flag against the token rule id, don't build
  an AST-level design-token linter in M2.
- Keep `score` float precision out of the pass decision: compare with `>=` on the raw fraction,
  don't round before comparing (boundary test pins this).
- Audit event type: `gate_result_brand` (greppable, consistent with M1 gate event naming).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

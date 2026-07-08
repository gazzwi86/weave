---
type: Task
title: "Task: TASK-010 — Agent-Grounding Authority & Escalation Patterns (E7-S4)"
description: "Full authority(actor, action, target) and escalation(process) executable SELECT
  patterns over CE-READ-1 with deny-default, explicit-deny-wins, and coverage-gap rows; plus the
  framework competency-question set (FR-036-full, FR-037). No new contract."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-007
milestone: M2
created: 2026-07-08
blocked_by: []
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

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-007 E7-S4, FR-036/FR-037)
Contracts: [contracts.md](../../../../contracts.md) (CE-READ-1 — no new contract) · M2 delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §8

## Story

As an agent runtime (and the humans governing it), I need to ask the graph "what may this agent
do, on which systems and data, and who does it escalate to" — and get answers only from what is
modelled, with silence resolving to deny — so agent authority is a property of the constitution,
never an assumption.

## Scope

E7-S4: the `authority(actor, action, target)` and `escalation(process)` parameterised SELECT
patterns (ported from obpm `mi-agent-model.ttl`), the workspace-tunable deny-default, coverage-gap
rows, and the framework competency-question set (FR-037) with the < 2-domain-questions onboarding
flag. Read-side over CE-READ-1 — **no new contract minted**. Runtime enforcement is Events &
Actions' job, not CE's.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-010-01 | WHEN a caller runs `authority(actor, action, target)` against a populated BPMO graph THE SYSTEM SHALL answer from modelled `governedBy`/`performedBy`/`accesses` links and policy/constraint individuals — never inventing an answer where the graph is silent. |
| AC-010-02 | WHEN the graph does not state a permission THE SYSTEM SHALL resolve it to **deny / route-to-human** — default, tunable per workspace via PLAT-SETTINGS-1. |
| AC-010-03 | WHEN an explicit deny exists THE SYSTEM SHALL let it override any inferred/broader authority. |
| AC-010-04 | WHEN a required link is missing (e.g. a Process with no `performedBy`) THE SYSTEM SHALL return an explicit **coverage-gap row** for that entity — never an empty result readable as "permitted". |
| AC-010-05 | WHEN `escalation(process)` runs THE SYSTEM SHALL return the escalation Actor and any modelled deadline from the process's exception/escalation links, with a coverage-gap row when unmodelled. |
| AC-010-06 | WHEN the patterns execute THE SYSTEM SHALL pass through the same B3 sanitizer as every CE-READ-1 SELECT (SELECT-only, `SERVICE`-blocked, paginated) — extending the M1 `coverage_gap` implementation, not forking it. |
| AC-010-07 | WHEN the framework competency-question set runs against the seeded graph THE SYSTEM SHALL return non-empty results for every framework question (FR-037), and a workspace with < 2 declared domain competency questions SHALL be flagged at onboarding. |
| AC-010-08 | WHEN patterns run THE SYSTEM SHALL meet p95 ≤ 500 ms at the 100k store (m2-delta §9). |

## Pseudocode

```text
# Named parameterised patterns, stored server-side beside M1's coverage_gap:
authority(actor, action, target):
    SELECT modelled permissions:  actor -[performedBy|accesses|governedBy]- target
    UNION explicit denies         (deny wins in post-processing, not SPARQL trickery)
    UNION coverage-gap branch:    target lacking required links -> gap row
    post-process: no permission row AND no gap row -> synthesize DENY row
                  (source: "default", tunable flag from PLAT-SETTINGS-1)

escalation(process):
    SELECT process -[exception/escalation links]-> actor, deadline
    else -> coverage-gap row

# Result row shape (fixed): {subject, verdict: allow|deny|gap, source:
#   modelled|explicit-deny|default, via_links[], escalate_to?, deadline?}
```

## API Contracts

- Rides **CE-READ-1**'s existing SPARQL surface (named-pattern invocation like M1's
  `coverage_gap`). No new endpoints, no new contract (FR-036: "no new contract minted").
- Deny-default toggle read from **PLAT-SETTINGS-1** (workspace scope).

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Authority patterns design | [m2-delta.md](../../tech-spec/m2-delta.md) §8 | Safety semantics + shared-sanitizer rule |
| M1 query path | [architecture.md](../../tech-spec/architecture.md) | The CE-READ-1 surface + B3 sanitizer these patterns extend |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Deny synthesized in post-processing, not in SPARQL | A "no rows = deny" rule inside SPARQL is exactly the empty-result-reads-as-permitted trap; explicit synthesis keeps the verdict row auditable | FR-036 AC (failure) |
| Extend M1 `coverage_gap`, do not fork | Same fail-closed family, same row conventions, one implementation to test | m2-delta §8 |
| CE answers, Events enforces | The model expresses authority; runtime conduct is EA-AUTOMATION-1's hinge — CE never becomes a policy engine | EPIC-007 technical notes |
| Fixed verdict-row shape with `source` field | Agents and audits must distinguish modelled-deny from default-deny; a bare boolean hides it | FR-036 semantics |

## Test Requirements

Minimum: 4 unit, 4 integration, 1 E2E-style seeded scenario.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should synthesize deny row with source=default when no permission and no gap | AC-010-02 |
| Unit | should let explicit deny override a broader modelled allow | AC-010-03 |
| Unit | should emit gap row for process lacking performedBy | AC-010-04 |
| Unit | should read deny-default tunable from settings fixture | AC-010-02 |
| Integration | should answer the three FR-036 example questions on the seeded Hammerbarn graph | AC-010-01, AC-010-05 |
| Integration | should route patterns through the shared B3 sanitizer (SERVICE-bearing param rejected) | AC-010-06 |
| Integration | should return non-empty results for every framework competency question on the seed | AC-010-07 |
| Integration | should flag a workspace with < 2 domain competency questions | AC-010-07 |
| Perf | locust: authority pattern p95 ≤ 500 ms @ 100k | AC-010-08 |
| Scenario | seeded agent asks "may I execute Activity X alone" — unmodelled ⟹ deny/route-to-human end-to-end | AC-010-01/02/04 |

## Dependencies

- **blocked_by**: none within M2 (needs a populated graph — the Hammerbarn seed from M1 plus M2
  fixtures suffices; no M2 task dependency)
- **unlocks**: none in CE (grounds Build/Events agents externally)

## Cost Estimate

**M** — est. **400k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). Two patterns + post-processor
+ question set; obpm port gives the query skeletons.

## DoR Checklist

- [x] Safety semantics pinned (deny-default, explicit-deny-wins, gap rows — m2-delta §8)
- [x] obpm `mi-agent-model.ttl` available as porting reference
- [x] No-new-contract confirmed (FR-036); settings key scope confirmed (PLAT-SETTINGS-1)
- [x] Seeded graph fixtures exist (Hammerbarn M1)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + perf + scenario)
- [ ] Verdict rows always carry `source`; no bare-boolean authority anywhere
- [ ] Sanitizer shared with M1 (no second sanitizer — invariant check)
- [ ] Framework competency-question set committed as fixtures + shipped queries
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Port order from obpm: permission links first, explicit denies second, gaps third — each UNION
  branch unit-testable on its own fixture.
- The deny-default synthesis is the security floor: write its test FIRST (TDD), it is the one
  behaviour that must never regress.
- Competency questions: ship as named queries in the same server-side store as
  `coverage_gap`/`authority`; the onboarding flag is a count check, not new UI (Onboarding
  engine renders it).
- Pitfall: "action" granularity — actions are modelled verbs on links (`performedBy`,
  `accesses`), not free strings; validate the action parameter against the relationship
  predicate list from `GET /api/ontology/types`.

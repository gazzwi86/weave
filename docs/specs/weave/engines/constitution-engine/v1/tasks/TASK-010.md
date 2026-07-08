---
type: Task
title: "Task: TASK-010 — Agent-Grounding Authority & Escalation Patterns (E7-S4, base-links descope)"
description: "authority(actor, action, target) and escalation(process) SELECT patterns over
  CE-READ-1 — M2 DESCOPE (ADR-013): base-links resolution only, deny-default + coverage_gap,
  decision never 'permit'; no ODRL/Authority-Extension resolution (post-v1). Plus the framework
  competency-question set (FR-036, FR-037). No new contract."
tags: [constitution-engine, arch, task, milestone-v1]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-007
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: []
adr_refs: [ADR-013]
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
[m2-delta.md](../../tech-spec/m2-delta.md) §8 · Descope decision:
[ADR-013](../../decisions/ADR-013.md)

## Story

As an agent runtime (and the humans governing it), I need to ask the graph "what may this agent
do, on which systems and data, and who does it escalate to" — and get answers only from what is
modelled, with silence resolving to deny — so agent authority is a property of the constitution,
never an assumption.

## Scope

E7-S4 **at the M2 descope (ADR-013)**: `authority(actor, action, target)` and
`escalation(process)` parameterised SELECT patterns resolving from **base BPMO links only**
(`performedBy` / `governedBy` / `accesses`), the tenant/domain-tunable deny-default,
`coverage_gap(kind, required_links[])` rows, and the framework competency-question set (FR-037).
The "< 2 declared domain questions" onboarding flag is **descoped to post-v1** (mirrors the
authority descope, ADR-013): no CE query/shape backs a countable "declared domain competency
question" individual in M2, so Onboarding ships it as a manual self-mark checklist item, not a
CE-sourced count (OQ-M2-1). Read-side over CE-READ-1 — **no new contract minted**. Runtime
enforcement is Events & Actions' job, not CE's.

**OUT (post-v1, ADR-013):** ODRL Authority-Extension resolution — `Permission` chains,
explicit-deny (`odrl:Prohibition`) override, `authorityLevel`, HITL triggers, escalation
deadlines. In M2 the base BPMO cannot express a permission, so `decision` is **never
`"permit"`**. OQ-AUTH-1 (ship canonical extension vs document client pattern) is deferred
post-v1.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-010-01 | WHEN a caller runs `authority(actor, action, target)` against a populated BPMO graph THE SYSTEM SHALL answer from the modelled base links (`governedBy`/`performedBy`/`accesses`) and Policy individuals only — never inventing an answer where the graph is silent, and never resolving anything the base links cannot express. |
| AC-010-02 | WHEN the graph does not state a permission (always true in M2 — no Authority Extension) THE SYSTEM SHALL resolve to **deny / route-to-human** — default, tunable per tenant/domain via the PLAT-SETTINGS-1 cascade. |
| AC-010-03 | WHEN `authority()` returns THE SYSTEM SHALL emit the CE-READ-1 response convention `{ rows, decision: "permit"\|"deny"\|"coverage-gap" }` and in M2 SHALL never return `decision: "permit"` — the only reachable decisions are `"deny"` and `"coverage-gap"` (buildable deny-default; explicit-deny override arrives with the post-v1 Authority Extension, ADR-013). |
| AC-010-04 | WHEN a required link is missing THE SYSTEM SHALL return explicit coverage-gap rows shaped `{ entity_iri, missing_link }` (one row per absent link, per CE-READ-1), with `coverage_gap(kind, required_links[])` supporting the default invocation `(Process, [performedBy, governedBy])` — never an empty result readable as "permitted". |
| AC-010-05 | WHEN `escalation(process)` runs THE SYSTEM SHALL return the escalation Actor(s) from the process's modelled links, with a coverage-gap row when unmodelled. (Deadline evaluation — `escalationDeadline` — is post-v1 Authority Extension; no deadline column is served in M2.) |
| AC-010-06 | WHEN the patterns execute THE SYSTEM SHALL pass through the same B3 sanitizer as every CE-READ-1 SELECT (SELECT-only, `SERVICE`-blocked, paginated) — extending the M1 `coverage_gap` implementation, not forking it. |
| AC-010-07 | WHEN the framework competency-question set runs against the seeded graph THE SYSTEM SHALL return non-empty results for every framework question (FR-037). Per-tenant "< 2 declared domain questions" flagging is **post-v1** — no CE query or shape backs a countable declared-question individual in M2; Onboarding renders the flag as a manual self-mark checklist item (OQ-M2-1), not a CE-sourced count. |
| AC-010-08 | WHEN patterns run THE SYSTEM SHALL meet p95 ≤ 500 ms at the 100k store (m2-delta §9). |

## Pseudocode

```text
# Named parameterised patterns, stored server-side beside M1's coverage_gap:
authority(actor, action, target):
    SELECT base-link evidence: actor -[performedBy|accesses|governedBy]- target
    SELECT coverage-gap branch: target lacking required links -> {entity_iri, missing_link} rows
    post-process (deny synthesized here, not in SPARQL):
        gap rows present            -> decision = "coverage-gap"
        else                        -> decision = "deny"   # M2: no Permission model exists,
                                                           # so "permit" is unreachable
    return { rows, decision }       # CE-READ-1 convention; rows may carry
                                    # source: modelled|default detail per row

escalation(process):
    SELECT process -[escalation/exception links]-> actor    # base links only; NO deadline in M2
    else -> coverage-gap row
```

## API Contracts

- Rides **CE-READ-1**'s existing SPARQL surface (named-pattern invocation like M1's
  `coverage_gap`). No new endpoints, no new contract (FR-036: "no new contract minted").
  Response convention `{ rows, decision: "permit"|"deny"|"coverage-gap" }` is canonical in
  contracts.md (CE-READ-1); `"permit"` is unreachable until the post-v1 Authority Extension.
- Deny-default toggle read from **PLAT-SETTINGS-1** (tenant/domain scope — 3-level
  Company→Domain→Project cascade; the former workspace level is removed).

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Authority patterns design | [m2-delta.md](../../tech-spec/m2-delta.md) §8 | Safety semantics + shared-sanitizer rule (descoped per ADR-013) |
| M1 query path | [architecture.md](../../tech-spec/architecture.md) | The CE-READ-1 surface + B3 sanitizer these patterns extend |
| Descope + post-v1 backlog | [ADR-013](../../decisions/ADR-013.md) | What M2 ships vs what the Authority Extension adds post-v1 |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Deny synthesized in post-processing, not in SPARQL | A "no rows = deny" rule inside SPARQL is exactly the empty-result-reads-as-permitted trap; explicit synthesis keeps the decision auditable | FR-036 AC (failure) |
| M2 descope to base links; `permit` unreachable | The base 13-kind BPMO cannot express Permission/authority-level/explicit deny; shipping resolution over absent data would ground agents on lies | ADR-013, contracts.md CE-READ-1 |
| Extend M1 `coverage_gap`, do not fork | Same fail-closed family, same `{entity_iri, missing_link}` row convention, one implementation to test | m2-delta §8, contracts.md |
| CE answers, Events enforces | The model expresses authority; runtime conduct is EA-AUTOMATION-1's hinge — CE never becomes a policy engine | EPIC-007 technical notes |
| Response = `{ rows, decision }` per CE-READ-1; per-row `source` detail retained inside rows | Consumers get the contracted envelope; audits still distinguish modelled-deny evidence from default-deny synthesis without a bespoke shape | contracts.md CE-READ-1, FR-036 semantics |

## Test Requirements

Minimum: 4 unit, 4 integration, 1 E2E-style seeded scenario.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should return decision=deny when no base-link evidence and no gap rows | AC-010-02, AC-010-03 |
| Unit | should never produce decision=permit (schema/branch test: permit is unreachable in M2) | AC-010-03 |
| Unit | should emit `{entity_iri, missing_link}` gap rows for a Process lacking performedBy (default invocation) | AC-010-04 |
| Unit | should read deny-default tunable from settings fixture (tenant/domain cascade) | AC-010-02 |
| Integration | should answer the three FR-036 example questions on the seeded Hammerbarn graph from base links only | AC-010-01, AC-010-05 |
| Integration | should route patterns through the shared B3 sanitizer (SERVICE-bearing param rejected) | AC-010-06 |
| Integration | should return non-empty results for every framework competency question on the seed | AC-010-07 |
| Perf | locust: authority pattern p95 ≤ 500 ms @ 100k | AC-010-08 |
| Scenario | seeded agent asks "may I execute Activity X alone" — unmodelled ⟹ deny/route-to-human end-to-end | AC-010-01/02/04 |

## Dependencies

- **blocked_by**: none within M2 (needs a populated graph — the Hammerbarn seed from M1 plus M2
  fixtures suffices; no M2 task dependency)
- **unlocks**: none in CE (grounds Build/Events agents externally)

## Cost Estimate

**M** — est. **350k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). Two base-link patterns +
deny post-processor + question set; the descope removes the ODRL resolution work.

## DoR Checklist

- [x] Safety semantics pinned (deny-default, gap rows, permit unreachable — ADR-013, m2-delta §8)
- [x] obpm `mi-agent-model.ttl` available as porting reference (query skeletons; permission
      branches NOT ported in M2)
- [x] No-new-contract confirmed (FR-036); settings key scope confirmed (PLAT-SETTINGS-1
      tenant/domain cascade)
- [x] Seeded graph fixtures exist (Hammerbarn M1)
- [x] OQ-AUTH-1 marked deferred post-v1 (ADR-013)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + perf + scenario)
- [ ] Responses use `{ rows, decision }` (CE-READ-1); permit-unreachable test green; no
      bare-boolean authority anywhere
- [ ] Sanitizer shared with M1 (no second sanitizer — invariant check)
- [ ] Framework competency-question set committed as fixtures + shipped queries
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Port order from obpm: base evidence links first, gaps second — each branch unit-testable on
  its own fixture. Do NOT port the permission/deny branches (post-v1, ADR-013).
- The deny-default synthesis is the security floor: write its test FIRST (TDD), it is the one
  behaviour that must never regress.
- Competency questions: ship as named queries in the same server-side store as
  `coverage_gap`/`authority`. The "< 2 declared" onboarding flag is **not CE's job in M2** — it
  ships as an Onboarding-rendered manual self-mark checklist item (OQ-M2-1), not a CE count query.
- Pitfall: "action" granularity — actions are modelled verbs on links (`performedBy`,
  `accesses`), not free strings; validate the action parameter against the relationship
  predicate list from `GET /api/ontology/types`.

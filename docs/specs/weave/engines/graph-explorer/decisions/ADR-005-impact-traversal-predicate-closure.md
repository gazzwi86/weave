---
type: ADR
title: "ADR-005: Impact-traversal predicate closure (OQ-09)"
description: "Pins the 13-entry directed predicate closure for Explorer impact/dependency
  traversal against CE's 18 shipped BPMO predicates; one shared config, two walk directions."
tags: [graph-explorer, adr, oq-09, traversal]
status: Accepted
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer/decisions/ADR-005-impact-traversal-predicate-closure.md
date: 2026-07-08
entity: graph-explorer
---

# ADR-005: Impact-traversal predicate closure (OQ-09)

## Status

Accepted *(approved 2026-07-08; `produces` membership explicitly confirmed by user — elicited via
20Q session: [`00-elicit/20Q-oq09-predicate-closure.md`](../00-elicit/20Q-oq09-predicate-closure.md))*

## Context

FR-010 / E2-S3 mandate impact ("what breaks if this changes") and dependency ("what does this
rely on") traces via CE-READ-1 SPARQL property-path SELECT. The PRD deliberately refused to
hard-code the predicate set (SS-GE-4, design decision D8): the closure had to be resolved
against CE's shipped data model. That model is now committed
([CE data-model §BPMO Relationship Predicates](../../constitution-engine/tech-spec/data-model.md))
with 18 predicates, each with domain, range, and inverse. GE M1 TASK-005 AC-6/AC-7 and the M2
pinned-impact overlay (E4-S3) are blocked on this decision.

## Decision

**Closure = 13 directed entries.** Every entry is normalised to read
*dependent → dependency* ("the thing that depends → the thing it depends on"):

| # | Predicate | Stored direction (CE) | Orientation | Normalised reading |
|---|---|---|---|---|
| 1 | `weave:dependsOn` | Process\|Service → Service\|System | forward | as stored |
| 2 | `weave:runsOn` | Service → System | forward | service depends on system |
| 3 | `weave:accesses` | Service → DataAsset | forward | service depends on data |
| 4 | `weave:consumes` | Process\|Activity → DataAsset | forward | process depends on input data |
| 5 | `weave:triggeredBy` | Process → Event | forward | process depends on trigger |
| 6 | `weave:hasStep` | Process → Activity | forward | process depends on its steps |
| 7 | `weave:hasField` | DataAsset → Field | forward | dataset depends on its columns |
| 8 | `weave:performedBy` | Process\|Activity → Actor | forward | process depends on performer |
| 9 | `weave:governedBy` | Process\|DataAsset\|Activity → Policy | forward | governed thing depends on policy |
| 10 | `weave:produces` | Process\|Activity → DataAsset | **inverse** | output data depends on producing process |
| 11 | `weave:realizes` | Process → BusinessCapability | **inverse** | capability depends on realizing process |
| 12 | `weave:servesGoal` | BusinessCapability → Goal | **inverse** | goal depends on serving capability |
| 13 | `weave:partOf` | part → whole (Any) | **inverse** | whole depends on its parts |

**Excluded (5):** `weave:inDomain`, `weave:hasCapability` (organisational grouping — domain
membership is Focus Domain's separate `domain_membership_predicate` concern), `weave:describes`
(untyped Any→Any annotation; would over-connect), `skos:broader`, `skos:related` (glossary
navigation, not operational dependency). 13 + 5 = all 18 canonical CE predicate rows classified.

Declared **inverse** predicates (`weave:stepOf`, `weave:performs`, `weave:consumedBy`,
`weave:producedBy`, `weave:triggers`, `weave:realizedBy`, `weave:goalServedBy`,
`weave:hasMember`, `weave:governs`, `weave:hosts`, `weave:accessedBy`, `weave:fieldOf`,
`weave:hasPart`, `skos:narrower`) are NOT separate closure entries — each is covered by its
canonical row plus the orientation flag; excluding a row excludes its inverse
(so `skos:narrower` is excluded with `skos:broader`).

**Walk semantics — one list, two directions.** Dependency trace from node *N* walks the
normalised direction (*N* → its dependencies, transitively). Impact trace walks backwards
(everything that transitively depends on *N*). Both traces read the SAME config; they are
mirror-consistent by construction.

**Config.** The existing D8 seam, now with a pinned shape and default value:

```json
{
  "oq09_predicate_closure": [
    { "predicate": "weave:dependsOn",   "orientation": "forward" },
    { "predicate": "weave:runsOn",      "orientation": "forward" },
    { "predicate": "weave:accesses",    "orientation": "forward" },
    { "predicate": "weave:consumes",    "orientation": "forward" },
    { "predicate": "weave:triggeredBy", "orientation": "forward" },
    { "predicate": "weave:hasStep",     "orientation": "forward" },
    { "predicate": "weave:hasField",    "orientation": "forward" },
    { "predicate": "weave:performedBy", "orientation": "forward" },
    { "predicate": "weave:governedBy",  "orientation": "forward" },
    { "predicate": "weave:produces",    "orientation": "inverse" },
    { "predicate": "weave:realizes",    "orientation": "inverse" },
    { "predicate": "weave:servesGoal",  "orientation": "inverse" },
    { "predicate": "weave:partOf",      "orientation": "inverse" }
  ]
}
```

- Static, checked-in app config — same for every tenant. Per-tenant override via
  PLAT-SETTINGS-1 is **deferred** until demanded; the entry shape is additive-upgrade-safe.
- No predicate IRI may appear as a literal in traversal code (D8 stands; grep-checkable).
- **Drift guard:** at canvas boot, every closure predicate MUST resolve against
  `GET /api/ontology/types` (CE-READ-1). An unresolvable entry fails loud (config error
  surfaced, traversal disabled) — never a silent empty trace.

**SPARQL realisation.** The property path is the alternation of the 13 entries with `^`
applied to inverse entries for a dependency walk (and the mirrored alternation for impact),
depth-capped per FR-010 (default 6, tunable). Composition of the path expression from config
is TASK-005's implementation concern; this ADR pins only the closure and its semantics.

## Consequences

- GE M1 TASK-005 AC-6/AC-7 unblock; M2 E4-S3 (pinned impact) and E2-S3-dependent tests can name
  concrete fixtures (e.g. Policy change must reach governed Process; Field change must reach
  consuming Process via `hasField` inverse-walk + `consumes`).
- Traces climb the full business chain (System → Service → Process → Capability → Goal, plus
  Actor and Policy) — richest cross-silo answer; noise is bounded by depth cap 6 and the
  existing entity-type filter toggles (E3-S1), not by thinning the closure.
- Concept/glossary nodes never appear in traces (still rendered on canvas).
- CE renaming or adding predicates surfaces as a loud config-drift failure, not silent
  truncation; adding a new predicate to the closure is a one-line config change + fixture.

## Alternatives Considered

- **Two independent closures (impact vs dependency).** Rejected: no asymmetric-trace
  requirement exists; two lists drift apart silently. (20Q Q7.)
- **Per-tenant closure via PLAT-SETTINGS-1 now.** Rejected: speculative knob, adds a Platform
  dependency + settings UI with no demand; shape permits adding it later. (20Q Q8.)
- **Include `inDomain`/`hasCapability`.** Rejected: every trace would balloon to whole-domain
  size, defeating the depth cap. (20Q Q5.)
- **Tech-only closure (exclude performedBy/governedBy/realizes/servesGoal).** Rejected:
  cross-silo visibility is the product's pitch; compliance and exec personas need policy and
  goal reach. (20Q Q3.)
- **Hard-code the predicate list in code.** Rejected long ago (SS-GE-4/D8) — config seam stands.

---
type: Elicitation
title: "Twenty Questions: OQ-09 impact-traversal predicate closure — Graph Explorer"
description: "Resolved which of CE's 18 BPMO predicates are dependency-bearing for impact/dependency
  traversal, each edge's normalised orientation, and the closure config mechanics. Feeds ADR-018."
tags: [graph-explorer, 00-elicit, twenty-questions]
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/00-elicit/20Q-oq09-predicate-closure.md
---

# 20 Questions Analysis: OQ-09 — impact-traversal predicate closure

## Starting Scope

Which of the 18 shipped BPMO relationship predicates (CE data-model
[`bpmo-relationship-predicates`](../../constitution-engine/tech-spec/data-model.md)) form the
closure for Explorer impact/dependency traversal (E2-S3, FR-010), and in which traversal
orientation. Session closed in 8 questions (early completion).

## Question Log

### Round 1 (Q1–Q4) — which edge families are dependency-bearing

1. Core "runs-on / uses" edges (`dependsOn`, `runsOn`, `accesses`, `consumes`, `triggeredBy`)?
   → **Include all five.**
2. Containment edges (`hasStep`, `hasField`, `partOf`) — does a whole depend on its parts?
   → **Yes, include all three.**
3. People & business-why edges (`performedBy`, `governedBy`, `realizes`, `servesGoal`)?
   → **Full chain — include all four** (noise managed by depth cap 6 + entity-type filters).
4. Glossary/annotation edges (`describes`, `skos:broader/narrower/related`)?
   → **Exclude all** (`describes` is untyped Any→Any; SKOS edges are glossary navigation).

**Established:** 12 edge families in; annotation/glossary out. (`produces` surfaced in Round 2.)

### Round 2 (Q5–Q8) — orientation and mechanics

5. Grouping edges `inDomain`, `hasCapability`? → **Exclude both** (grouping, not dependency;
   domain membership is Focus Domain's separate concern).
6. Orientation table — normalise every entry to "dependent → dependency"; INVERT `produces`,
   `realizes`, `servesGoal`, `partOf`; others forward? → **Accepted** (this added `produces`,
   inverted, to the closure — 13 entries total).
7. One shared closure list, two walk directions (dependency = forward, impact = backward)?
   → **One list.**
8. Config placement? → **Static app config** (checked-in default `oq09_predicate_closure`,
   same for all tenants; per-tenant override deferred, shape upgrade-safe).

## Synthesis

### Established Facts

- Closure = 13 directed entries; 5 predicates excluded (`inDomain`, `hasCapability`,
  `describes`, `skos:broader`, `skos:related`). 13 + 5 = all 18 CE predicates accounted for.
- Forward (9): `dependsOn`, `runsOn`, `accesses`, `consumes`, `triggeredBy`, `hasStep`,
  `hasField`, `performedBy`, `governedBy`.
- Inverse (4): `produces`, `realizes`, `servesGoal`, `partOf`.
- Dependency trace walks the normalised direction; impact trace walks it backwards — one config
  feeds both, mirror-consistent by construction.
- Config stays the D8 seam (`config.oq09_predicate_closure`), never hard-coded in code.

### Specific Requirement / Decision

Full decision record: [ADR-018](../decisions/ADR-018-impact-traversal-predicate-closure.md).
Unblocks m1 TASK-013 AC-6/AC-7 and M2 E2-S3-dependent overlays (E4-S3 pinned impact).

### Remaining Ambiguity

- `produces` entered via the Round 2 orientation table rather than a Round 1 family question —
  count flagged for explicit human confirm at ADR-018 approval.
- Per-tenant closure override intentionally deferred (no demand); shape supports it additively.

## Captured As

Folded into ADR-018 (Graph Explorer decisions).

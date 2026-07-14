---
type: Task
title: "Task: TASK-018 — SKOS Cross-Notation Reconciliation"
description: "E12-S5 (FR-042): collapse entities ingested from multiple notations that denote
  the same concept into ONE canonical punned owl:Class + skos:Concept (decision B1), merge
  proposals above 0.85 similarity, human-confirmed, SHACL-blocked conflicts surfaced."
tags: [constitution-engine, arch, task, post-v1, ingest, skos, reconciliation]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-012
milestone: post-v1
created: 2026-07-08
blocked_by: [TASK-012, TASK-015]
unlocks: [TASK-019]
adr_refs: [ADR-011]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-042, E12-S5;
decision B1) · Contracts: [contracts.md](../../../../contracts.md) (CE-WRITE-1, CE-READ-1) ·
v1 delta: [v1-delta.md](../../tech-spec/v1-delta.md) §1, §6

## Story

As a user who imported the same process from a BPMN file, an ArchiMate model, and a policy
document, I want duplicates collapsed into one canonical concept, so downstream reads (NL
query, Explorer, Build) see one resource instead of three near-copies.

## Scope

The reconciler (worker component, runs on demand post-ingest and as a job-completion pass).
IN: candidate-pair generation over ingested entities (same-kind, label/definition similarity),
similarity scoring, merge proposals (≥ 0.85 via settings `ingest.merge_similarity_threshold`)
into the TASK-012 proposal store for human confirmation, merge execution as CE-WRITE-1 ops
(retarget edges → canonical IRI, `skos:altLabel` the loser's label, delete duplicate), SHACL
conflict surfacing. Result shape per decision B1: one punned `owl:Class` + `skos:Concept` — NO
separate cross-notation linking property. OUT: auto-merge below threshold (never), embedding
infra (uses TASK-014's if present, string similarity as the floor).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-007-01 | WHEN reconciliation runs over entities ingested from multiple notations denoting the same concept THE SYSTEM SHALL propose collapsing them to ONE canonical resource via the same find-existing-node flow semantics (same-label + same-kind reuse), yielding one punned `owl:Class` + `skos:Concept` (decision B1 — no cross-notation linking property anywhere). |
| AC-007-02 | WHEN a pair's label/definition similarity ≥ threshold (default 0.85, settings) THE SYSTEM SHALL propose the merge for human confirmation; below it THE SYSTEM SHALL never auto-merge nor propose (`below-threshold-merge-never-auto`). |
| AC-007-03 | WHEN a human accepts a merge THE SYSTEM SHALL execute it as one CE-WRITE-1 batch: incident edges retargeted to the canonical IRI, losing label kept as `skos:altLabel`, duplicate deleted — with PROV-O recording the merge activity and both source artefacts. |
| AC-007-04 | WHEN a proposed merge would violate SHACL (e.g. conflicting single-valued properties) THE SYSTEM SHALL block it at commit (422) and surface the conflict for manual resolution against the proposal. |
| AC-007-05 | WHEN a merge completes THE SYSTEM SHALL leave downstream reads seeing exactly one canonical concept (CE-READ-1 resource fetch of the old IRI count = 0 duplicates; NL query returns one row). |
| AC-007-06 | WHEN candidate pairs are generated THE SYSTEM SHALL only pair same-kind entities within the tenant (never cross-kind, never cross-tenant). |

## Pseudocode

```text
def reconcile(tenant, scope=recent_ingests):
    entities = sparql_select(kind, label, definition, source_artefact FOR scope)
    for (a, b) in same_kind_pairs(entities):             # blocked: kind mismatch
        s = similarity(a, b)                             # normalized label edit-distance
                                                         # + definition cosine IF corpus
                                                         # embeddings exist (TASK-014), else
                                                         # label-only  # ponytail: string floor
        if s >= settings.merge_threshold:
            ops = [retarget_edges(b -> a), add(a, skos:altLabel, b.label),
                   copy_missing_props(b -> a), delete_node(b)]
            proposal_store.insert(kind='merge', ops=ops, confidence=s,
                                  detail=side_by_side(a, b))
# acceptance runs through TASK-012's accept -> prospective SHACL -> CE-WRITE-1;
# conflicting single-valued props fail validation there -> 422 -> AC-007-04 surfaces it.
```

## API Contracts

No new endpoints — merge proposals are TASK-012 proposals (kind=`merge`), reviewed on the
import page (TASK-019) / chat. Mutation: **CE-WRITE-1** only; CE-READ-1 verifies the collapsed
view.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | SKOS Reconciler position (worker) |
| Punning decision | engine spec decision B1 (constitution-engine.md) | One punned class+concept, no linking property |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Merge = ordinary proposal in the TASK-012 store | Human confirmation, 422 surfacing, audit — all inherited; no bespoke merge UI flow | v1-delta §1 |
| One canonical resource, no `owl:sameAs`/linking property | Decision B1 — downstream reads must see ONE concept, not a link to chase | engine spec E12-S5 |
| Similarity floor = string metrics; embeddings only if TASK-014 present | Keeps 007 buildable without corpus infra; embeddings are an accuracy upgrade, not a dependency | ponytail ladder |
| Losing label survives as `skos:altLabel` | Cross-notation vocabulary is signal — future imports of that label re-match the canonical resource | SKOS standards |

## Test Requirements

Minimum: 4 unit, 4 integration.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should score identical-label same-kind pair above threshold | AC-007-02 |
| Unit | should never generate cross-kind or cross-tenant pairs | AC-007-06 |
| Unit | should build merge ops: retarget, altLabel, copy-missing, delete | AC-007-03 |
| Unit | should not propose below threshold (`below-threshold-merge-never-auto`) | AC-007-02 |
| Integration | BPMN + ArchiMate fixtures importing the same process → merge proposed → accept → one punned class+concept, edges retargeted, PROV names both artefacts | AC-007-01/03 |
| Integration | conflicting single-valued props → 422 with conflict surfaced, graph unchanged | AC-007-04 |
| Integration | post-merge CE-READ-1 + NL query see exactly one concept | AC-007-05 |
| Integration | altLabel re-match: re-importing the losing label links to canonical, no new node | AC-007-01 |

## Dependencies

- **blocked_by**: TASK-012 (proposal store), TASK-015 (needs ≥ 2 notations actually landing to
  reconcile across — fixtures come from its converters)
- **unlocks**: TASK-019

## Cost Estimate

**M** — est. **400k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). Pairing + scoring + merge-op
builder; the review/commit machinery is inherited.

## DoR Checklist

- [x] Threshold + settings key pinned (v1-delta §6; OQ-18 open, tunable)
- [x] Result shape pinned (decision B1, punned resource)
- [x] Merge-as-proposal flow pinned (TASK-012)
- [ ] TASK-012 + TASK-015 merged (DAG)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass; named test verbatim: `below-threshold-merge-never-auto`
- [ ] No `owl:sameAs` or custom linking property anywhere in merge output (B1 invariant)
- [ ] No literal 0.85 outside settings defaults
- [ ] Coverage ≥ 80%, mutation ≥ 60%; Law E budgets

## Implementation Hints

- Pair generation must be bounded: candidate pairs only within (tenant, kind, recent-ingest
  scope), blocked on label first-token or fuzzy-key — O(n²) over a whole tenant graph is the
  3am pager. <!-- ponytail: blocked pairing; proper LSH only if tenants exceed ~10k entities/kind -->
- `retarget_edges` needs both directions: edges where the duplicate is subject AND object —
  SPARQL both patterns before building ops.
- Pitfall: copy-missing-props must not overwrite the canonical's existing values — only fill
  absent properties; conflicts on single-valued props are NOT resolved automatically, that's
  the AC-007-04 422 path by design.
- Pitfall: merge ops are one batch (atomicity via CE-WRITE-1's clone-validate-commit) — never
  retarget in one commit and delete in another; a crash between them orphans the graph.

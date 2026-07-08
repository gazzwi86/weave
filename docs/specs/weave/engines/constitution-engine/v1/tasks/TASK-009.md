---
type: Task
title: "Task: TASK-009 — CE-FUNCTION-1 Registry (Definition Surface)"
description: "Ontology-bound function registry: weave:Function individuals via CE-WRITE-1,
  SHACL-subset→JSON-Schema derived projection, GET /api/functions list+detail, immutability with
  fail-closed breaking taxonomy, status flags (ADR-009; M2 = definition surface only)."
tags: [constitution-engine, arch, task, milestone-v1]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-010
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: []
adr_refs: [ADR-009]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (CE-FUNCTION-1 section)
Contracts: [contracts.md](../../../../contracts.md) (CE-FUNCTION-1 — canonical shape) · ADR:
[ADR-009](../../decisions/ADR-009.md) · M2 delta: [m2-delta.md](../../tech-spec/m2-delta.md) §6

## Story

As the Build Engine, I need one registry of named, typed, graph-bound functions — with signatures
I can codegen typed SDK methods from without parsing RDF — and as the Events Engine, I need to
reference those functions by stable `fn_iri`, so business logic primitives have exactly one
definition and one owner.

## Scope

The **M2 definition surface, complete** (ADR-009 Q4 split, pinned in contracts.md): function
definition + revision via CE-WRITE-1, the SHACL-subset→JSON-Schema converter, `GET /api/functions`
+ `GET /api/functions/{iri}`, breaking/deprecation semantics, the projection round-trip contract
test. **Execution is v1.0 — nothing here invokes, binds, or runs a function.** Provides
**CE-FUNCTION-1 (M2 surface)**.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-009-01 | WHEN a function is defined THE SYSTEM SHALL commit a `weave:Function` individual to the tenant draft graph via CE-WRITE-1, whose parameters and return each reference a BPMO kind IRI (from `GET /api/ontology/types` — never a hand-copied list) plus an optional `sh:NodeShape`; SHACL validates the individual, PROV-O stamps it. |
| AC-009-02 | WHEN `GET /api/functions` is called THE SYSTEM SHALL return `[{ fn_iri, name, bound_kind, signature, version_iri, status, breaking }]` where `version_iri` **is the CE-VERSION-1 IRI** (no per-function lineage exists anywhere in the payload or storage). |
| AC-009-03 | WHEN `GET /api/functions/{iri}` is called THE SYSTEM SHALL return the RDF-level signature (kind/shape IRIs), grounding entity IRIs, AND the **derived JSON Schema** — derived by CE's converter on read (cacheable by graph version), never stored or hand-edited. |
| AC-009-04 | WHEN a published function's signature would be changed in-place THE SYSTEM SHALL reject the mutation (422) — published signatures are immutable; the change must land as a revision that publishes as a new graph version. |
| AC-009-05 | WHEN a revision changes the signature (param added/removed/retyped, or return changed) THE SYSTEM SHALL flag the registry entry `breaking: true` for that version — meaning **that version introduced a breaking change vs the previous published version**; label/description edits are non-breaking; any unclassified change class defaults to breaking (fail-closed). |
| AC-009-06 | WHEN a function has `status: "deprecated"` THE SYSTEM SHALL keep it resolving on both endpoints (existing references work) and expose the status so Events refuses NEW automation bindings. |
| AC-009-07 | WHEN the projection round-trip contract test runs THE SYSTEM SHALL demonstrate for every seeded function that the derived JSON Schema accepts exactly the node set its SHACL shape accepts (positive + negative fixtures) — converter drift fails CI. |
| AC-009-08 | WHEN the endpoints are called THE SYSTEM SHALL meet p95 ≤ 300 ms (list) / ≤ 400 ms (detail incl. derivation) at the 100k store; 401 without JWT; 404 unknown `fn_iri`. |

## Pseudocode

```text
# Model (tenant draft graph):
weave:Function {name, boundKind -> kindIRI, status: active|deprecated,
                param*: {name, kindIRI, shapeIRI?}, return: {kindIRI, shapeIRI?}}

# Converter — SIGNATURE SUBSET of SHACL only (ADR-009: not a general translator):
to_json_schema(param) ->
    base = {"type": "object", "properties": {"iri": {"type":"string","format":"iri"},
            "kind": {"const": param.kindIRI}}}
    if param.shapeIRI: fold supported constraints only:
        sh:datatype -> type/format | sh:minCount/maxCount -> required/array bounds |
        sh:in -> enum | sh:pattern -> pattern | sh:min/maxLength -> length bounds
    unsupported SHACL construct in a signature shape -> 422 AT DEFINITION TIME
    (reject early; never silently drop a constraint from the projection)

# Immutability check (in CE-WRITE-1 validation for weave:Function targets):
if fn exists in latest PUBLISHED version and op mutates signature fields -> 422
breaking = classify(diff(published_sig, new_sig))   # unknown class -> True

GET /api/functions        -> SELECT individuals -> list shape (cache by graph version)
GET /api/functions/{iri}  -> individual + derive JSON Schema (cache by graph version)
```

## API Contracts

- **CE-FUNCTION-1** (canonical in [contracts.md](../../../../contracts.md), incl. milestone
  split): `GET /api/functions`, `GET /api/functions/{iri}`. Errors: 401, 404, 500 (list/detail);
  definition-time 422s surface through CE-WRITE-1's standard error shape. p95 per AC-009-08.
- Writes via **CE-WRITE-1 only** — no POST/PUT under `/api/functions*` (derived-projection
  invariant).

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Registry design | [m2-delta.md](../../tech-spec/m2-delta.md) §6 | Model, converter scope, versioning rules |
| M2 component delta | [m2-delta.md](../../tech-spec/m2-delta.md) §10 | Function Registry component wired to CE-WRITE-1/RDF/Build/Events |
| Typing-model decision | [ADR-009](../../decisions/ADR-009.md) | Why RDF+projection; elicitation record; churn assumption |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| RDF source of truth + derived JSON Schema | Wins semantic-nativeness AND codegen ergonomics; CE owns the one converter so consumers never fork mappings | ADR-009 (elicitation, 106/120) |
| Converter rejects unsupported constructs at definition time | A silently dropped constraint makes the JSON Schema accept nodes the shape rejects — the exact drift the round-trip test exists to catch; fail early instead | ADR-009 drift mitigation |
| `version_iri` = CE-VERSION-1, no per-function lineage | Zero new versioning machinery; Build already pins CE versions (BE-ARTEFACT-1). Accepted churn assumption + revisit trigger recorded | ADR-009 §2 |
| Immutability enforced in the CE-WRITE-1 gate | Enforcing at the single mutation entry point covers form, chat, and any future ingest path at once | FR-003, ADR-009 §3 |
| No execution semantics | M2/v1.0 split pinned in contracts.md — "nothing about executing a function is M2" | ADR-009 §5 |

## Test Requirements

Minimum: 5 unit, 4 integration, 1 contract.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should convert each supported SHACL construct to its JSON-Schema equivalent (table-driven) | AC-009-03 |
| Unit | should 422 a signature shape using an unsupported construct | AC-009-03 |
| Unit | should classify breaking: param add/remove/retype + return change = true; label/description = false; unknown = true | AC-009-05 |
| Unit | should build list-entry shape with version_iri from CE-VERSION-1 resolution | AC-009-02 |
| Unit | should contain no function-local semver anywhere in schemas (schema introspection) | AC-009-02 |
| Integration | should define a function via CE-WRITE-1 and read it back on both endpoints | AC-009-01/02/03 |
| Integration | should 422 an in-place signature edit of a published function; allow label edit | AC-009-04, AC-009-05 |
| Integration | should keep a deprecated function resolving with status exposed | AC-009-06 |
| Integration | should 401/404 correctly; p95 via locust case | AC-009-08 |
| Contract | **round-trip: derived JSON Schema accepts exactly the shape-valid node set** (positive+negative fixtures per seeded function) | AC-009-07 |

## Dependencies

- **blocked_by**: none within M2 (consumes M1 spine: CE-WRITE-1, types endpoint, version
  resolution) — parallel
- **unlocks**: none in CE (unblocks Build M2 SDK codegen + Events action references externally)

## Cost Estimate

**L** — est. **700k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). The converter + its
table-driven tests + the round-trip harness are the bulk; two endpoints and the immutability gate
are routine.

## DoR Checklist

- [x] Typing model decided + human-confirmed (ADR-009, elicitation record in frontmatter)
- [x] Contract shape canonical incl. `status`/`breaking`/baseline sentence + milestone split (contracts.md)
- [x] Supported SHACL construct subset enumerated (Pseudocode; anything else 422s)
- [x] p95 pinned (m2-delta §9); round-trip test pinned (ADR-009)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + contract + perf)
- [ ] Round-trip contract test green and wired into CI
- [ ] No POST/PUT route under `/api/functions*` (invariant check)
- [ ] No per-function semver field anywhere (invariant check)
- [ ] Breaking taxonomy fail-closed verified (unknown change class ⟹ breaking)
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Converter: one dispatch table `{sh_construct: fold_fn}`; the unsupported-construct check is
  "constraint predicate not in table ⟹ 422". Table-driven tests mirror the table 1:1.
- Immutability diff: compare against the function's individual in the **latest published**
  version graph (immutable named graph — cheap SELECT), not against draft history.
- Signature canonical form: sort params by declared order, normalise IRIs before diffing —
  otherwise reordering serialisation falsely reads as breaking.
- Reuse the TASK-003 projection-cache pattern (key: tenant + resolved version/draft hash) — same
  derivation rule, same cache, different payload.
- Pitfall: `bound_kind` vs param kinds — `bound_kind` is the kind the function is *bound to*
  (its home concept, e.g. Activity produced); params reference their own kinds. Do not conflate.

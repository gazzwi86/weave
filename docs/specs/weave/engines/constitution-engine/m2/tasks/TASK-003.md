---
type: Task
title: "Task: TASK-003 — Brand & Voice Model + CE-BRAND-1 Projections"
description: "Governed brand-standard and VoiceRule RDF individuals with SHACL gating, plus the
  CE-BRAND-1 derived projections: GET /api/brand/tokens and GET /api/brand/voice-rules (E4-S1 +
  E4-S2 backend floor, FR-016)."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-004
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: ["TASK-004"]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-004, FR-016/FR-024)
Contracts: [contracts.md](../../../../contracts.md) (CE-BRAND-1) · M2 delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §4

## Story

As a brand/marketing owner, I need brand styleguides and tone-of-voice rules to live in one
governed, versioned, provenance-stamped home — and as the Build Engine, I need them as flat JSON
tokens and machine-evaluable rules — so generated artefacts are compliant by construction without
anyone parsing RDF.

## Scope

EPIC-004 E4-S1 (govern brand standards) + the E4-S2 Must floor (VoiceRule model + projection;
manual entry — AI extraction is Should and NOT this task). Backend + contract surface only; UI is
TASK-004. Provides **CE-BRAND-1**.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-003-01 | WHEN a brand standard is committed THE SYSTEM SHALL store it as an RDF individual (brand-standard class) with content type, content body or source URI, effective date, and owner — via CE-WRITE-1, versioned, PROV-O-stamped. |
| AC-003-02 | WHEN a brand individual fails its SHACL shape THE SYSTEM SHALL reject at commit (422); a failed individual can therefore never appear in any projection. |
| AC-003-03 | WHEN Build calls `GET /api/brand/tokens` THE SYSTEM SHALL return the **closed-core + extensions** token JSON (see Pseudocode: `color`, `typography`, `spacing`, `radius` closed core + `extensions` open map) derived from the RDF individuals — derived on read, cacheable by graph version, never stored as a second source. Build M2 codegens ONLY the closed core; `extensions` entries pass through untyped. |
| AC-003-04 | WHEN Build calls `GET /api/brand/voice-rules` THE SYSTEM SHALL return VoiceRules each declaring `{ id, severity: "critical"\|"normal", assertion }` where `assertion` is mechanically checkable. |
| AC-003-05 | WHEN a VoiceRule is authored without a machine-evaluable assertion THE SYSTEM SHALL reject it (SHACL, 422) — a human label alone is not a rule. |
| AC-003-06 | WHEN either projection endpoint is called THE SYSTEM SHALL respond p95 ≤ 400 ms at the 100k-triple store (m2-delta.md §9) and pass the CE-BRAND-1 contract test (Build consumes without parsing RDF). |
| AC-003-07 | WHEN either endpoint is called without a valid JWT THE SYSTEM SHALL return 401; an unknown version parameter SHALL return 404. |

## Pseudocode

```text
# Model (framework graph: classes; tenant graph: individuals)
weave:BrandStandard  props: contentType, contentBody|sourceUri, effectiveDate, owner
weave:VoiceRule      props: ruleId, severity in {critical, normal}, humanLabel,
                             assertion (machine-evaluable, required by shape)

GET /api/brand/tokens?version=latest|{iri}:
    individuals = SELECT brand-standard individuals from resolved graph
    return flatten_to_token_json(individuals)     # pure function, unit-testable
    # cache key: (tenant_id, resolved_version_or_draft_hash)

# Token JSON shape — CLOSED CORE (v1, Build M2 codegen target) + OPEN EXTENSIONS:
{
  "color":      { "<name>": "<hex|rgba>" },                     # e.g. primary, surface, text
  "typography": { "fontFamily": { "<role>": "<stack>" },        # role: body|heading|mono
                  "scale": { "<step>": { "size": "<rem>",       # step: xs..3xl
                                          "lineHeight": "<num>",
                                          "weight": <100-900> } } },
  "spacing":    { "<step>": "<rem|px>" },                       # step: 0..12 scale
  "radius":     { "<step>": "<rem|px>" },                       # step: none|sm|md|lg|full
  "extensions": { "<namespaced.key>": <any JSON> }              # untyped pass-through
}
# Closed core is a STABLE codegen contract: adding a core field = contract change
# (contracts.md amendment). New/custom tokens go in extensions until promoted.

GET /api/brand/voice-rules?version=...:
    rules = SELECT VoiceRule individuals
    return [{id, severity, assertion} ...]

# Conformance score: defined in contracts.md; CE serves rules, Build runs the gate.
# CE does NOT compute scores. Do not build a scoring endpoint.
```

## API Contracts

- **CE-BRAND-1** (canonical in [contracts.md](../../../../contracts.md)): `GET /api/brand/tokens`,
  `GET /api/brand/voice-rules`. Error floor: 401 (no JWT), 404 (bad version), 422 never (read-only),
  500. p95 ≤ 400 ms each.
- Writes go through **CE-WRITE-1** only — projections have NO write routes
  (invariant: derived, never hand-edited).

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| M2 component delta | [m2-delta.md](../../tech-spec/m2-delta.md) §10 | Brand Projection component wired to CE-WRITE-1 + RDF store + Build |
| Projection rule | [m2-delta.md](../../tech-spec/m2-delta.md) §4 | Derived-on-read, version-cached, no re-filtering rule |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Projection, not a second store | RDF is the single source of truth; tokens/voice-rules are derived views re-derived on read | contracts.md CE-BRAND-1, m2-delta §4 |
| Projection code does not re-filter SHACL failures | 422-at-commit already guarantees only valid individuals exist; re-filtering would hide gate bugs | m2-delta §4 |
| Conformance score is Build's gate, not a CE endpoint | contracts.md defines the formula; CE only serves rules — building a score endpoint here duplicates Build's gate | contracts.md CE-BRAND-1 |
| Assertion required by shape (not convention) | Build mechanically evaluates assertions; an assertion-less rule would silently weaken the Build gate | EPIC-004 technical notes |
| Closed-core + extensions token shape | Build codegen needs a stable enumerated target (core); tenants need custom tokens without contract churn (extensions, untyped pass-through) | HITL amendment 2026-07-08, contracts.md CE-BRAND-1 |

## Test Requirements

Minimum: 4 unit, 4 integration, 1 contract.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should flatten brand individuals to token JSON (pure function, fixture graph) | AC-003-03 |
| Unit | should map VoiceRule individual to {id, severity, assertion} | AC-003-04 |
| Unit | should key projection cache on (tenant, version/draft-hash) | AC-003-03 |
| Unit | should not contain any re-filtering of SHACL-invalid individuals in projection path | AC-003-02 |
| Integration | should 422 a brand individual missing required property; projection then never shows it | AC-003-02 |
| Integration | should 422 a VoiceRule without machine-evaluable assertion | AC-003-05 |
| Integration | should return 401 without JWT and 404 on unknown version, both endpoints | AC-003-07 |
| Integration | should stamp PROV-O + version on brand commit | AC-003-01 |
| Contract | CE-BRAND-1 contract test: Build-side fixture consumes both payloads without RDF parsing | AC-003-06 |
| Perf | locust case: both endpoints p95 ≤ 400 ms @ 100k store | AC-003-06 |

## Dependencies

- **blocked_by**: none within M2 (consumes M1 spine only) — runs parallel to TASK-001
- **unlocks**: TASK-004 (brand UI)

## Cost Estimate

**M** — est. **400k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). Two classes + shapes, two
read endpoints, one pure-function flattener, contract + perf tests.

## DoR Checklist

- [x] CE-BRAND-1 shape + conformance formula canonical in contracts.md
- [x] Projection rule pinned (m2-delta §4); p95 pinned (§9)
- [x] Token JSON field set pinned: closed core (`color`/`typography`/`spacing`/`radius`) + open `extensions` map (HITL 2026-07-08)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + contract + perf)
- [ ] CE-BRAND-1 contract test green and wired into CI
- [ ] No write route exists under `/api/brand/*` (invariant check)
- [ ] Projection cache invalidates on commit (new draft hash) — verified by test
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Follow the CE-METRICS pattern of SPARQL SELECT + Pydantic response models; the flattener is a
  pure function over bindings — keep it free of store access for unit-testability.
- Reuse the M1 version-resolution helper (`?version=latest|{iri}` → graph IRI) used by CE-READ-1;
  do not re-implement resolution.
- VoiceRule `assertion` shape: keep it a constrained string DSL at M2 (e.g. regex / max-length /
  forbidden-term assertions) — the shape requires presence + declared assertion type; Build owns
  evaluation. Do not build an assertion interpreter in CE.
- Pitfall: draft vs published projections — Build consumes published versions; default
  `?version=latest` (published), draft only when explicitly requested.

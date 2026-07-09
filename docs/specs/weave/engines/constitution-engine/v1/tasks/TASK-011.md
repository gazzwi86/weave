---
type: Task
title: "Task: TASK-011 — Kind-Level Descriptions via skos:definition"
description: "Every framework BPMO kind served by GET /api/ontology/types carries a plain-language
  skos:definition, authored in the Turtle source and exposed as a description field on the
  CE-READ-1 types response."
tags: [constitution-engine, arch, task, milestone-v1]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-010
milestone: v1
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

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-010, CE-READ-1)
Contracts: [contracts.md](../../../../contracts.md) (CE-READ-1 — response-shape amendment pending,
coordinator-owned) · M2 delta: [m2-delta.md](../../tech-spec/m2-delta.md)

## Story

As a business modeller using the Graph Explorer right panel or a Constitution authoring surface, I
need a plain-language description of what a framework kind (e.g. Process, Actor, DataAsset) means
— not just its name — so I can pick the right kind without already knowing the BPMO grammar.

## Scope

Every one of the 13 framework BPMO kinds served by `GET /api/ontology/types` (CE-READ-1) carries a
`skos:definition` in the shipped framework Turtle. The `GET /api/ontology/types` response adds a
`description` field per kind, sourced from that `skos:definition` — never a hand-maintained second
copy. **Framework kinds only** in this task; client-authored extension kinds already carry their
own `skos:definition` via the punned glossary path (EPIC-003, TASK-001) and are out of scope here.

**Epic parent — EPIC-010 (Stable Read & Write Interfaces), not EPIC-001 or EPIC-003:** the
deliverable is a `CE-READ-1` response-shape addition (a field on `GET /api/ontology/types`), which
EPIC-010 owns end-to-end — the same pattern TASK-009 (CE-FUNCTION-1) followed for another
CE-READ-1-family surface. EPIC-001 (Ontology Modelling) owns *client* authoring of new classes, not
the shipped framework kinds' own static content. EPIC-003 (SKOS Glossary) owns *client-authored*
`skos:Concept` terms via CE-WRITE-1, not the read-only framework vocabulary shipped as a static
file (mirrors how framework SHACL shapes ship as a static Turtle file per ADR-001, not through
CE-WRITE-1).

**OUT:** the contracts.md CE-READ-1 shape amendment itself (coordinator-owned, lands separately —
this task's endpoint change must be compatible with, not duplicate, that amendment). No new
endpoint. No client-facing authoring of framework-kind definitions (they are shipped, read-only).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-011-01 | WHEN the framework Turtle is loaded THE SYSTEM SHALL require every one of the 13 BPMO framework kinds to carry exactly one `skos:definition` (plain-language, non-empty) — enforced by a completeness test over the shipped ontology file, not a runtime check. |
| AC-011-02 | WHEN `GET /api/ontology/types` is called THE SYSTEM SHALL include a `description` field per kind in the response, sourced from that kind's `skos:definition` — no second, hand-maintained copy of the text anywhere in the codebase. |
| AC-011-03 | WHEN the Graph Explorer right panel renders a framework kind THE SYSTEM SHALL display its `description` field from the CE-READ-1 response (no GE-side hardcoded kind copy). |
| AC-011-04 | WHEN a CE authoring surface (e.g. the class/kind picker) renders a framework kind THE SYSTEM SHALL display the same `description` field from the same response — one source, both surfaces. |
| AC-011-05 | WHEN a client extension kind (not one of the 13 framework kinds) is served by `GET /api/ontology/types` THE SYSTEM SHALL leave `description` absent or null rather than inventing framework-style copy — extension-kind descriptions are the EPIC-003 glossary path, not this task. |

## Pseudocode

```text
# Framework Turtle (ontology/framework.bpmo.ttl or equivalent shipped file):
weave:Process a owl:Class ;
    skos:definition "A repeatable sequence of activities that produces a defined outcome." .
# ... one skos:definition per framework kind, all 13

GET /api/ontology/types:
    kinds = load_framework_kinds() + load_client_extension_kinds()
    for kind in kinds:
        kind.description = kind.skos_definition if kind.skos_definition else None
    return { kinds: [...], relationship_types: [...] }   # existing shape + description field

completeness_test():
    for kind in FRAMEWORK_KINDS:  # all 13, enumerated
        assert kind.skos_definition is not None and kind.skos_definition.strip() != ""
```

## API Contracts

- **CE-READ-1** `GET /api/ontology/types` — adds a `description` field per kind entry. The
  canonical response-shape amendment in [contracts.md](../../../../contracts.md) is
  **coordinator-owned and lands separately**; this task's implementation must match that shape
  once it lands and must not diverge from it in the interim (same field name, same nullability for
  extension kinds).
- No new endpoint; no write route. Reads only.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| CE-READ-1 read path | [architecture.md](../../tech-spec/architecture.md) | Where `GET /api/ontology/types` is served from |
| Framework vs tenant graph split | [ADR-001](../../decisions/ADR-001.md) | Why framework kind content ships as a static file, not via CE-WRITE-1 |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| `skos:definition` authored in the framework Turtle, not a second config/JSON copy | One source of truth; matches how the punned glossary already uses `skos:definition` for client terms (EPIC-003) | EPIC-003 TASK-001 precedent |
| Framework-kind descriptions are read-only/shipped, not client-authored | The 13 kinds are the upper-framework grammar, not tenant content — same status as framework SHACL shapes | ADR-001, ontology-standards.md |
| Extension kinds get `description: null`, not invented copy | Framework and client vocabularies must not blur; extension-kind meaning is the glossary's job (EPIC-003), not this task's | Scope boundary, AC-011-05 |
| Epic parent = EPIC-010, not EPIC-001/EPIC-003 | The change is a CE-READ-1 response-shape addition; EPIC-010 owns that contract surface (TASK-009 precedent) | this task's Scope rationale |

## Test Requirements

Minimum: 2 unit, 2 integration, 1 completeness test.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should load a non-empty `skos:definition` string per framework kind from the Turtle fixture | AC-011-01 |
| Unit | should map a kind's `skos:definition` to the response's `description` field, unmodified | AC-011-02 |
| Completeness | should assert all 13 framework kinds carry a non-empty `skos:definition` (enumerated list, fails loudly on a missing one) | AC-011-01 |
| Integration | `GET /api/ontology/types` should return `description` populated for every framework kind on the seeded graph | AC-011-02 |
| Integration | `GET /api/ontology/types` should return `description: null` (not invented text) for a client extension kind fixture | AC-011-05 |

## Dependencies

- **blocked_by**: none within M2 (consumes the M1 `GET /api/ontology/types` surface, already
  shipped)
- **unlocks**: none in CE (GE right-panel and CE authoring-surface consumption are external UI
  work, unblocked once `description` is served)

## Cost Estimate

**S** — est. **150k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). Thirteen short definitions +
one response-field pass-through + a completeness test; no new endpoint, no write path.

## DoR Checklist

- [x] `GET /api/ontology/types` (CE-READ-1) already shipped (M1) — this task only adds a field
- [x] Framework-kind list is fixed at 13 (BPMO, per ontology-standards.md) — enumerable for the
      completeness test
- [ ] Coordinator's contracts.md CE-READ-1 shape amendment landed (field name/nullability
      confirmed) — **contract amendment pending, coordinator-owned**; this task tracks it, does
      not block on authoring the definitions themselves
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + completeness)
- [ ] All 13 framework kinds carry a non-empty `skos:definition` in the shipped Turtle
- [ ] `description` field matches the coordinator-landed contracts.md shape exactly (no drift)
- [ ] No second hand-maintained copy of kind descriptions anywhere in the codebase (grep check)
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Write the 13 definitions once, in the same framework Turtle file the kinds themselves are
  declared in — do not create a parallel descriptions file.
- The completeness test should enumerate the 13 kind IRIs explicitly (not "count == 13") so an
  accidental rename silently passing a count check cannot slip through.
- Reuse the existing `GET /api/ontology/types` handler's kind-loading path; `description` is a
  field added to the same per-kind dict, not a second query.
- Pitfall: don't block this task on the coordinator's contracts.md amendment landing first — author
  the definitions and the pass-through field now, and reconcile field naming when the amendment
  lands (tracked in the DoR checklist above).

## Design requirements

Source bundle: **R12 — Kind list polish** (`docs/design/v1-design-requirements.md`), grounded in
finding **F-D14** (Minor, `docs/design/design-assessment-2026-07-09.md:68`): "Kind list (`/ce/types`):
no `skos:definition` descriptions (planned v1 need), rows aren't links to a kind detail/shape view,
and '1 properties' grammar." This task closes the first half (the descriptions); the other two
F-D14 items are UI-only and land in the same surface refit.

- **Description text rendering** (AC-011-03, AC-011-04; F-D14) — the kind list row and the CE
  authoring-surface kind picker both render the returned `description` field as secondary text
  under/beside the kind name. Token binding: `--text-body-sm` (`typography.md:66`, "secondary text,
  captions, dense tables") and `--color-text-muted` for colour — not `--color-text-subtle`, which
  is reserved for large-text/non-body use and fails the 4.5:1 floor at this size
  (`typography.md:116-121`).
- **Absent-description state** (AC-011-05; F-D14) — when `description` is null (extension kinds),
  the row renders with no secondary text line, not a placeholder dash or blank reserved space that
  misaligns row height against rows that do have a description.
- **Row → kind-detail link** (F-D14, R12) — each kind-list row links through to a kind detail/shape
  view, closing F-D14's "rows aren't links to a kind detail/shape view" finding. This is a UI
  behaviour riding the same surface as the `description` field but is not gated by this task's ACs
  (no AC covers it) — implement it alongside AC-011-03/04 since it is the same row.
- **Pluralisation fix** (F-D14, R12) — the "N properties" count label uses correct singular/plural
  grammar ("1 property" / "2 properties"), closing F-D14's "'1 properties' grammar" finding.
  ADVISORY: if a shared count+noun helper exists elsewhere in the codebase, the same fix likely
  applies there too — a scope check for the engineer, not a new acceptance criterion for this task.

ADVISORY (not cited, flagged): the kind-list row is not yet built onto a design-system `DataTable`
organism — that component only lands with R13 (`PLAT-V1-TASK-026`, not confirmed landed as of this
brief). If R13 has not landed by build time, style the row with existing tokens per the bindings
above rather than waiting on the organism; a later refit onto `DataTable` is separate follow-up
work, not blocked on or blocking this task.

GAPS: `docs/design/jtbd.md` has no dedicated entry for the kind-list/schema-catalogue surface
(`/ce/types`) — the nearest entry, "Constitution → Overview" (health-snapshot job), doesn't
precisely cover a kind glossary/definition view. Flagged per graceful degradation; no success
criteria invented beyond what F-D14/R12 state literally.

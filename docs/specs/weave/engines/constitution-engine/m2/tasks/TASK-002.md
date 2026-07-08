---
type: Task
title: "Task: TASK-002 — Glossary Search, Browse and Create UI"
description: "Glossary screen: search across prefLabel/altLabel/definition, browse with OWL-role
  display, no-match empty-state feeding the same CE-WRITE-1 creation path (E3-S3 + E3-S1 UI)."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-003
milestone: M2
created: 2026-07-08
blocked_by: ["TASK-001"]
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

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-003 E3-S3, FR-023)
Contracts: [contracts.md](../../../../contracts.md) · M2 delta: [m2-delta.md](../../tech-spec/m2-delta.md)

## Story

As any user, I need to search and browse the glossary — by preferred label, synonym, or words in
the definition — and create a missing term on the spot, so the agreed vocabulary is the easiest
thing to find, not a buried document.

## Scope

EPIC-003 story E3-S3 (search/browse) plus the UI face of E3-S1 (create-term form + chat path).
Backend model/shape is TASK-001. This is a UI-bearing task: design tokens + `ui_verify` gate apply.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-002-01 | WHEN a user searches the glossary THE SYSTEM SHALL match case-insensitively across `skos:prefLabel`, `skos:altLabel`, and `skos:definition`, returning label, definition snippet, and the term's OWL role. |
| AC-002-02 | WHEN a search has no match THE SYSTEM SHALL show an empty-state with a "create term" affordance that feeds the SAME CE-WRITE-1 pipeline as E3-S1 — no separate creation path. |
| AC-002-03 | WHEN a user browses terms THE SYSTEM SHALL list them paginated (50/page via the CE-READ-1 `page=` parameter — the contract's pagination, not a bespoke cursor), ordered by prefLabel, each showing broader/narrower links as navigable chips. |
| AC-002-04 | WHEN a user creates a term via form or chat THE SYSTEM SHALL surface a 422 SHACL violation (e.g. duplicate prefLabel language) as a plain-language, field-anchored message. |
| AC-002-05 | WHEN the AI/chat surface is unavailable THE SYSTEM SHALL keep the form path fully functional (503 only on the chat surface). |
| AC-002-06 | WHEN the glossary page renders THE SYSTEM SHALL meet Lighthouse performance ≥ 90 and accessibility ≥ 95 (m2-delta.md §9) and use only `docs/standards/design/` tokens. |

## Pseudocode

```text
GlossaryPage:
    search(q) -> SPARQL SELECT (via existing CE-READ-1 proxy route):
        FILTER CONTAINS(LCASE(?prefLabel|?altLabel|?definition), LCASE(q))
        -> rows {iri, prefLabel, definitionSnippet, owlRole}
    browse(page) -> same SELECT sans filter, ORDER BY ?prefLabel, page=n (CE-READ-1 pagination)
    emptyState(q) -> CreateTermForm(prefill=q)
    CreateTermForm.submit -> TASK-001 op batch via POST /api/operations/apply
        on 422 -> map violation path -> field error (reuse M1 SHACL-message mapper)
```

## API Contracts

- Reads: **CE-READ-1** SPARQL SELECT through the existing frontend proxy (`/api/proxy/sparql`,
  B3-sanitized). No new backend endpoint.
- Writes: **CE-WRITE-1** `POST /api/operations/apply` via the TASK-001 op batch.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Authoring flows (form + chat) | [business-process.md](../../tech-spec/business-process.md) | The propose→validate→commit loop the create path reuses |
| M2 page targets | [m2-delta.md](../../tech-spec/m2-delta.md) §9 | Lighthouse + design-token gate for new M2 pages |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Empty-state create feeds the E3-S1 pipeline | One creation path; a search-page fork would bypass SHACL/PROV-O framing | EPIC-003 technical notes |
| Search over three SKOS properties in one SELECT | prefLabel/altLabel/definition is the FR-023 requirement; no search index at M2 scale | FR-023 · ponytail: SPARQL CONTAINS now, search index when corpus size hurts |
| Reuse M1 SHACL-violation → field-message mapper | Same 422 shape as every CE-WRITE-1 error; do not fork message handling | M1 TASK-005/006 pattern |

## Test Requirements

Minimum: 3 unit, 2 integration, 2 E2E.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should build search SELECT matching three SKOS properties case-insensitively | AC-002-01 |
| Unit | should render empty-state with create affordance when zero rows | AC-002-02 |
| Unit | should map a prefLabel uniqueLang violation to the language field error | AC-002-04 |
| Integration | should paginate browse at 50 via CE-READ-1 page= with prefLabel ordering | AC-002-03 |
| Integration | should keep form path live when chat surface returns 503 | AC-002-05 |
| E2E | should search "obligation", open term, navigate a broader chip | AC-002-01, AC-002-03 |
| E2E | should search a missing term, create it from empty-state, find it in browse (backend state asserted) | AC-002-02 |
| Gate | axe-core a11y pass + Lighthouse budget on glossary page | AC-002-06 |

## Dependencies

- **blocked_by**: TASK-001 (term model + shape must exist)
- **unlocks**: none (leaf)

## Cost Estimate

**M** — est. **400k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). One page, one form reusing
M1 form machinery, two E2E; UI-verify gate adds iteration cost.

## DoR Checklist

- [x] TASK-001 AC table stable (this brief consumes its op batch + shape)
- [x] Design system present at `docs/standards/design/` (M1 pages built against it)
- [x] Page targets pinned (m2-delta.md §9)
- [ ] TASK-001 merged
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] E2E asserts backend state change (term exists in draft graph after create) — Law B
- [ ] `ui_verify` gate passed; zero ad-hoc hex/px/duration values
- [ ] Lighthouse ≥ 90 perf / ≥ 95 a11y on the glossary page
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Reuse the M1 guided-form generator (SHACL shape → form fields, M1 TASK-006) for the create
  form — GlossaryTermShape already declares required fields; do not hand-code the form.
- OWL-role display: the term's `rdfs:subClassOf` target (if any) names its structural role; show
  "also a class" chip from the punned typing.
- Pitfall: definition snippets — truncate server-side in the SELECT (`SUBSTR`) or client-side
  after fetch; do not fetch full definitions for a 50-row list if definitions are long.
- Chat create path: the M1 chat panel already routes NL → op batch; add glossary-term intent to
  its existing parser config rather than a new chat surface.

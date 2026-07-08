---
type: Task
title: "Task: TASK-004 — Brand & Voice Authoring UI"
description: "Brand standards + voice rules screen: governed upload/entry forms over CE-WRITE-1,
  versioned history view, 503-degradation surface for the (Should-Have, out-of-scope) AI
  extraction path (E4-S1/E4-S2 UI)."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-004
milestone: M2
created: 2026-07-08
blocked_by: ["TASK-003"]
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

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-004, FR-016/FR-024)
Contracts: [contracts.md](../../../../contracts.md) (CE-BRAND-1) · M2 delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §4, §9

## Story

As a brand/marketing owner, I need one place to author and govern brand standards and
tone-of-voice rules — with versions and provenance visible — so the "single authoritative home"
promise is something I can actually see and trust, not just an API.

## Scope

UI for EPIC-004: brand-standard entry (form; source-URI or content body), VoiceRule entry
(human label + machine-evaluable assertion fields), list/history views. E4-S2 **AI extraction is
OUT of scope** (Should-Have, deferred) — this task only ships the extraction surface's
graceful-degradation state (button present, 503-explains-itself) so its later arrival is additive.
UI-bearing: design tokens + `ui_verify` gate apply.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-004-01 | WHEN a brand owner submits the brand-standard form THE SYSTEM SHALL dispatch a CE-WRITE-1 op batch creating the individual (content type, body or source URI, effective date, owner) and show the committed version + PROV-O actor on success. |
| AC-004-02 | WHEN a VoiceRule is authored THE SYSTEM SHALL require severity (`critical`/`normal`) and a machine-evaluable assertion field; a missing assertion surfaces the SHACL 422 as a field-anchored message before-or-at commit. |
| AC-004-03 | WHEN the brand screen lists standards/rules THE SYSTEM SHALL show current values from the draft graph with each item's last-modified PROV-O attribution, paginated at 50/page. |
| AC-004-04 | WHEN the AI-extraction affordance is used THE SYSTEM SHALL show the 503 "extraction not yet available" state AND keep all form paths fully live (FR-024 degradation). |
| AC-004-05 | WHEN the brand page renders THE SYSTEM SHALL meet Lighthouse ≥ 90 perf / ≥ 95 a11y and use only `docs/standards/design/` tokens. |

## Pseudocode

```text
BrandPage:
    tabs = [Standards, VoiceRules]
    list(tab, cursor) -> SPARQL SELECT via /api/proxy/sparql (individuals + prov actor)
    StandardForm.submit / VoiceRuleForm.submit
        -> op batch (add_node with class from TASK-003 model) -> POST /api/operations/apply
        -> 422 -> shared SHACL-message mapper -> field errors
    ExtractButton.click -> POST extraction surface -> render 503 state (forms untouched)
```

## API Contracts

- Writes: **CE-WRITE-1** `POST /api/operations/apply` (TASK-003 classes). No new endpoints.
- Reads: **CE-READ-1** SPARQL via existing proxy. CE-BRAND-1 projections are Build's surface,
  not this UI's — the UI reads individuals, not projections (avoids projection-cache coupling).

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Authoring flows | [business-process.md](../../tech-spec/business-process.md) | Form → validate → commit loop |
| M2 component delta | [m2-delta.md](../../tech-spec/m2-delta.md) §10 | Brand Projection vs authoring path separation |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| UI reads individuals, not CE-BRAND-1 projections | Projections are the Build contract; the authoring UI needs full individuals incl. provenance — reading projections would couple UI refresh to projection cache | m2-delta §4 |
| Extraction ships as a 503 state only | E4-S2 AI extraction is Should-Have deferred; shipping the degradation state now makes later arrival additive, and FR-024's failure AC is testable today | EPIC-004 AC (failure), roadmap carry |
| Reuse M1 guided-form machinery | TASK-003 shapes declare the fields; forms generate from shapes, not hand-coded | M1 TASK-006 pattern |

## Test Requirements

Minimum: 3 unit, 2 integration, 2 E2E.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should generate standard/voice-rule forms from TASK-003 SHACL shapes | AC-004-01, AC-004-02 |
| Unit | should render 503 extraction state with forms still enabled | AC-004-04 |
| Unit | should show PROV-O actor per list row | AC-004-03 |
| Integration | should commit standard via op batch and re-list it | AC-004-01 |
| Integration | should field-anchor a missing-assertion 422 | AC-004-02 |
| E2E | brand owner creates a voice rule; rule appears in list with attribution (backend state asserted) | AC-004-02, AC-004-03 |
| E2E | extraction affordance 503s; owner completes the same content via form | AC-004-04 |
| Gate | axe-core + Lighthouse budget on brand page | AC-004-05 |

## Dependencies

- **blocked_by**: TASK-003 (classes + shapes + endpoints)
- **unlocks**: none (leaf)

## Cost Estimate

**M** — est. **350k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). Two forms from existing
machinery, list views, one degradation state.

## DoR Checklist

- [x] TASK-003 AC table stable (classes/shapes this UI consumes)
- [x] Design system present; page targets pinned (m2-delta §9)
- [x] E4-S2 deferral pinned (extraction = 503 state only)
- [ ] TASK-003 merged
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] E2E asserts backend state change (Law B)
- [ ] `ui_verify` gate passed; tokens only
- [ ] Lighthouse ≥ 90 / ≥ 95 on brand page
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Assertion field: render as type-select (regex / forbidden-term / max-length per TASK-003 DSL)
  + value input — do not free-text the whole assertion; the shape validates presence + type.
- Version/provenance display: `prov:wasGeneratedBy` → activity → `prov:wasAssociatedWith` actor;
  the M1 versions page already renders this chain — reuse its component.
- Pitfall: source-URI vs content-body are mutually exclusive-ish (one required) — express as a
  SHACL `sh:xone` in TASK-003 and mirror the toggle in the form; do not validate only client-side.

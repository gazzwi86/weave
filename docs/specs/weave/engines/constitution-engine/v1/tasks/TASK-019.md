---
type: Task
title: "Task: TASK-019 — Import & Ingest Page, Epic E2E, CI Closure"
description: "Epic close: the Import & Ingest page (upload w/ FR-044 context step, job list,
  proposal review incl. merge proposals), the epic-level Playwright E2E, Lighthouse gate, and
  the CI structural asserts that make the epic-level AC (no second mutation path, corpus
  read-side-only) permanent."
tags: [constitution-engine, arch, task, milestone-v1, ingest, frontend, e2e, ci]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have (epic close)
entity: constitution-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: [TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018]
unlocks: []
adr_refs: [ADR-010, ADR-011, ADR-012]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-012 epic-level AC;
roadmap Phase-3 exit criteria) · v1 delta: [v1-delta.md](../../tech-spec/v1-delta.md) §7
(Lighthouse), §8 (testing delta), §9 (invariants) · Design system:
`docs/standards/design/` (tokens — CE-BRAND-1; no ad-hoc hex/px)

## Story

As the ingest user, I want one page to upload artefacts (with the optional context step),
watch jobs, and review every proposal type — and as the programme, we need the epic's
invariants CI-permanent — so Phase 3 exits with the cold-start loop demonstrable and guarded.

## Scope

IN: the **Import & Ingest** page (upload dropzone + FR-044 context form step [skippable],
job list with status/summary, proposal review table for structured/merge proposals — chat
remains E12-S1's surface), design-token styling, WCAG 2.1 AA + axe zero-violations + keyboard
nav, Lighthouse gate; the **epic-level Playwright E2E** (full loop incl. citation assert); CI
wiring of the structural asserts defined in TASK-012/003 plus the perf checks for ingest
endpoints; invariants.md merge of the v1-delta §9 entries. OUT: new backend behaviour (all
built in 001–007); progress.json seeding (coordinator follow-up).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-008-01 | WHEN a user opens Import & Ingest THE SYSTEM SHALL offer upload (file type routed to the right extractor kind), an optional pre-ingestion context step (FR-044 fields; skipping proceeds), and a job list with live status + committed/skipped/rejected summaries. |
| AC-008-02 | WHEN a job is awaiting review THE SYSTEM SHALL render proposals (incl. flagged/unmapped and merge proposals with side-by-side detail) with accept/reject per proposal; low-confidence and unmapped flags visually distinct, never pre-selected; 422 violations rendered against the proposal. |
| AC-008-03 | WHEN the page is audited THE SYSTEM SHALL meet Lighthouse performance ≥ 90, accessibility ≥ 95 (axe zero violations, full keyboard nav through upload→review→accept), best practices ≥ 90, initial JS ≤ 200 KB gzipped (v1-delta §7). |
| AC-008-04 | WHEN the epic E2E runs THE SYSTEM SHALL pass the full loop: upload doc → chat proposals → accept one/reject one → graph state changed (CE-READ-1) with correct PROV-O; import BPMN fixture → mapped proposals → accept → entities present; NL query over an ingested entity returns a citation (Law B: backend state asserted, not just UI). |
| AC-008-05 | WHEN CI runs on any branch THE SYSTEM SHALL enforce the structural asserts as pipeline failures: `no-second-mutation-path-ingest`, corpus read-side-only, no-DSN-in-RML-config, settings-not-literals — the epic-level AC made permanent (PRD §10). |
| AC-008-06 | WHEN the milestone closes THE SYSTEM SHALL have v1-delta §9 invariants merged into `tech-spec/invariants.md` with their verify-by selectors intact. |
| AC-008-07 | WHEN ingest perf checks run THE SYSTEM SHALL verify the v1-delta §2 p95 targets at the 100k seeded store (same harness as the standing ce-perf gate). |

## Pseudocode

```text
# Frontend (Next.js page, shadcn components, design tokens only):
/import page:
    <Dropzone> -> POST /api/ingest/artefacts (kind auto-detect by magic bytes/ext)
    <ContextStep optional fields={source_system, owner, date_of_truth, sensitivity, notes}>
    <JobList poll GET /api/ingest/jobs/*>          # reuse existing table components
    <ProposalReview job>                            # one table, renderer per proposal kind:
        op-list card (TASK-013 component) | mapping row (+sourceType annotation) |
        merge side-by-side | flagged badge
        accept/reject -> TASK-012 endpoints; 422 -> inline violations

# E2E (Playwright, Page Object Model):
test epic_cold_start_loop:
    upload fixture doc -> chat cards appear -> accept 1, reject 1
    assert GET /api/ontology/resource/{iri} exists; assert prov activity (LLM+human+used)
    upload bpmn fixture via /import -> accept mapped Activity
    POST /api/query/nl "what process handles claims?" -> assert citations[0].artefact_iri

# CI:
    structural asserts as pytest collection checks (import-linter style) in the main pipeline
    lighthouse-ci budget file for /import
    ce-perf additions: ingest endpoint p95 cases
```

## API Contracts

Consumes only what 001–007 built (v1-delta §2 table). No new endpoints. Contracts:
CE-WRITE-1/CE-READ-1 exercised end-to-end.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | The full surface this page fronts |
| Page targets | [v1-delta.md](../../tech-spec/v1-delta.md) §7 | Lighthouse budgets |
| Invariants | [v1-delta.md](../../tech-spec/v1-delta.md) §9 | What CI must make permanent |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| One page, renderer-per-proposal-kind | Five stories, one review model — mirrors the one-proposal-flow backend decision | v1-delta §1 |
| Chat stays E12-S1's surface; page serves structured/merge | Story text pins chat for documents; bulk row review needs a table, not chat | engine spec E12-S1/S4 |
| Structural asserts in main CI, not a separate workflow | A gate that doesn't run on every branch isn't a gate | harness-governance spirit |
| Design tokens only, ui_verify gate applies | UI-bearing work rule | CLAUDE.md conventions |

## Test Requirements

Minimum: 3 unit (component), 2 integration, 1 full E2E, Lighthouse + axe + perf gates.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit (component) | should render flagged proposal visually distinct + not pre-selected | AC-008-02 |
| Unit (component) | should render merge proposal side-by-side with both sources | AC-008-02 |
| Unit (component) | should allow skipping context step and still submit | AC-008-01 |
| Integration | should route file types to correct extractor kind at upload | AC-008-01 |
| Integration | should render 422 violations inline against the proposal | AC-008-02 |
| E2E | `epic_cold_start_loop` (see pseudocode — the Phase-3 demonstrable outcome) | AC-008-04 |
| Gate | Lighthouse budgets on /import; axe zero violations; keyboard-only run | AC-008-03 |
| Gate | CI structural asserts fail a seeded violation (verify the gate gates) | AC-008-05 |
| Perf | ingest p95 table (v1-delta §2) in ce-perf | AC-008-07 |

## Dependencies

- **blocked_by**: TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018 (epic close —
  fronts and verifies all of them; TASK-012 is transitively required)
- **unlocks**: none in CE (unblocks the Phase-3 gate ceremony externally)

## Cost Estimate

**L** — est. **600k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). Frontend page + component tests +
the epic E2E + three CI gate wirings; broad but shallow.

## DoR Checklist

- [x] All consumed endpoints + p95 pinned (v1-delta §2)
- [x] Lighthouse budgets pinned (v1-delta §7)
- [x] Invariants list pinned (v1-delta §9)
- [x] Design tokens exist (`docs/standards/design/`)
- [ ] TASK-013..007 merged (DAG)
- [ ] M1 program gate green (build precondition)

## Implementation Hints

- Reuse M1/M2 page scaffolding (job list ≈ versions table; proposal table ≈ validation report
  table) — this page should be mostly composition.
- The "verify the gate gates" test: temporarily seed a fake `ingest/` module importing a store
  write symbol in a fixture branch of the assert's own test — the assert must fail it. A gate
  never observed failing is unverified.
- Playwright: Page Object Model per standards; the E2E's LLM step uses the recorded fixture
  provider (Law F) so the loop is deterministic in CI.
- Pitfall: job-list polling must back off (visibility-aware interval) — a wall of tabs polling
  every second is self-inflicted load; and the proposal table must virtualise beyond ~200 rows
  (R2RML jobs produce thousands).
- Pitfall: axe + keyboard coverage must include the modal/side-by-side merge view, not just the
  happy table.

## DoD Checklist

- [ ] All ACs pass incl. `epic_cold_start_loop` E2E green in CI
- [ ] Lighthouse + axe + ui_verify gates green on /import
- [ ] CI structural asserts wired AND their failure-mode verified (gate-gates test)
- [ ] invariants.md updated with v1-delta §9 entries (verify-by selectors intact)
- [ ] Coverage ≥ 80%, mutation ≥ 60%; Law E budgets

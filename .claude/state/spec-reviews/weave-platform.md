# Spec review — weave-platform

**Date:** 2026-07-02 · **Verdict:** PASS (after fixes) · **Reviewed by:** /spec-review via /implement Step 1.5

## Findings and resolutions

| # | Finding (severity) | Resolution |
|---|---|---|
| 1 | CE-METRICS-1 timing contradiction: M1 fixed dashboard tiles (FR-000/FR-014, E1-S0, M1 exit criterion) consumed a CE M2 contract (CRITICAL) | E1-S0 + FR-000/FR-014 moved to M2 (user decision 2026-07-02). M1 ships placeholder dashboard route, zero CE calls. Roadmap M1/M2, PRD §2.6, EPIC-001, TASK-005 all reconciled. |
| 2 | PRD FR table + epic story ACs in Given/When/Then, not EARS (CRITICAL) | All FRs and story ACs rewritten in EARS (WHEN/WHERE/IF…THE SYSTEM SHALL). Zero `Given ` remaining. |
| 3 | `tech-spec/architecture.md` missing — no C4 (CRITICAL) | Produced via arch-c4: L1–L3 Mermaid C4, 9 design decisions (5 mandatory critic challenges), 11 EARS invariants, quality attributes. Split graph boundary (ADR-001 scoped SPARQL vs CE contracts) reconciled with data-model + TASK-003/005. |
| 4 | `tech-spec/testing-strategy.md` missing (CRITICAL) | Produced via arch-testing: full pyramid, LocalStack/pyoxigraph/fakeredis/respx fakes, AC-to-test mapping, four M1 release-gate tests at integration AND E2E layers. |
| 5 | TASK-007 DoR required v1.0 task TASK-006 (CRITICAL) | DoR line replaced with stubbed-connector item per the brief's own M1 scope note. |
| 6 | FR milestone column mixed "MVP" with M1/M2 (WARN) | Normalised to M1/M2/v1.0 per owning epic milestone. |
| 7 | `adr_refs: []` on ADR-touching tasks (WARN) | Backfilled: TASK-003 [ADR-001], TASK-004 [ADR-001, ADR-002], TASK-009 [ADR-001]. TASK-004 unlocks trimmed to M1 ids. |
| 8 | No consolidated openapi.yaml / class-diagram (WARN, non-blocking) | Deferred — contract shapes live in contracts.md + per-task API Contracts sections. Run arch-openapi before M2 if drift appears. |

Task briefs now reference `tech-spec/architecture.md` / `testing-strategy.md` rows in their
Diagram References tables (briefs stay self-contained; refs are anchors for QA + engineer).

Brief: PASS · PRD: PASS (post-fix) · Roadmap: PASS (post-fix) · Tech spec: PASS (post-fix) ·
Task briefs: PASS (post-fix) · Standards: PASS (1 cosmetic warn in design.md headings).

This file is the change-detection marker: /implement re-reviews if any weave-platform spec file
is newer than this file's mtime.

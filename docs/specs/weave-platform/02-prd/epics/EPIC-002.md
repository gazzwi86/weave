# Epic: EPIC-002 - Widget Library (engine-sourced data categories, phase-gated)

## Overview

**Phase:** Phase 2 (MVP) for CE-sourced stories (S1, S2, S5, S7-CE, S10, S11, S13, S14, S15) ·
Phase 3 (Post-MVP) for engine-gated stories (S3 per-run, S4, S7 Build rows, S8 automation rows, S9
realtime sub-widgets, S12)
**PRD Reference:** [prd.md](../prd.md#epic-2-widget-library-engine-sourced-data-categories-phase-gated)
**Status:** Backlog
**Priority:** Must Have (CE-sourced) / Should Have (some MVP) / P0 when source engine ships (engine-gated)

## Description

The catalogue of data-bound widget categories the Generative Dashboard can compose. Each category is
available only once its source engine is live: Constitution-sourced categories are MVP-eligible; Build-,
Events-, and Explorer-sourced categories are "P0 when source engine ships" and render a defined
"source engine not yet available" state until then. This epic is split across phases per the PRD's own
per-story phase tags, never fragmented further.

## User Stories

| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK-001 | Ontology health widgets — CE-sourced (E2-S1) | Backlog | Must Have |
| TASK-002 | Graph completeness / knowledge-gap widgets — CE-sourced (E2-S2) | Backlog | Must Have |
| TASK-003 | AI/token spend widgets — CE token portion MVP, per-run gated (E2-S3) | Backlog | Must Have |
| TASK-004 | Active project pipeline widgets — Build-gated (E2-S4) | Backlog | Should Have |
| TASK-005 | Compliance status widgets — CE-sourced (E2-S5) | Backlog | Must Have |
| TASK-006 | Self-improvement findings widgets — Weave-internal (E2-S6) | Backlog | Should Have |
| TASK-007 | Ontology and project issue widgets — CE MVP, Build rows gated (E2-S7) | Backlog | Must Have |
| TASK-008 | Event automation + connector-health widgets — health MVP, autom. gated (E2-S8) | Backlog | Must Have |
| TASK-009 | Collaboration activity widgets — async MVP, realtime Phase 2 (E2-S9) | Backlog | Should Have |
| TASK-010 | Sentiment analysis on audit logs — reads PLAT-AUDIT-1 (E2-S10) | Backlog | Should Have |
| TASK-011 | Agent activity feed widget — per-engine (E2-S11) | Backlog | Should Have |
| TASK-012 | Version pinning status widget — CE-version MVP, Build/Events gated (E2-S12) | Backlog | Should Have |
| TASK-013 | Graph growth trend widget — CE-sourced (E2-S13) | Backlog | Must Have |
| TASK-014 | RBAC and access coverage widget — platform-sourced (E2-S14) | Backlog | Should Have |
| TASK-015 | Workspace onboarding progress widget — CE-sourced (E2-S15) | Backlog | Must Have |

## Acceptance Criteria (Epic Level)

- [ ] Phase-gating is enforced uniformly: every category whose source engine is not GA renders the
      defined "source engine not yet available" state with no fabricated, zeroed, or hallucinated rows —
      a single not-yet-available regression test covers S4, the Build rows of S7/S12, the automation
      rows of S3/S8, and the realtime sub-widgets of S9 simultaneously.
- [ ] Every category cites its real source contract(s) in its footer and binds only to a published,
      available contract (`CE-METRICS-1`, `CE-READ-1`, `CE-VERSION-1`, `CE-EVENT-1`, `PLAT-AUDIT-1`,
      `PLAT-BILLING-1`, `PLAT-CONNECTOR-1`, `PLAT-IDENTITY-1`, `PLAT-SETTINGS-1`) — no category sources
      data from an engine surface that has no contract ID.
- [ ] Provider-error degradation is non-destructive and honest across the catalogue: on a contract
      error each widget shows its specified state (unavailable / stale-with-timestamp / delayed badge /
      "unknown") and never falls back to a value that would falsely imply health (e.g. version lag "0",
      RBAC "zero gaps", sentiment refresh as a real new score) — one degradation sweep verifies all.
- [ ] Weave-internal-only categories (S6 self-improvement findings) return no data and are not offered
      to any client-tenant role — verified by an authz test on the platform-operator boundary.
- [ ] Configurable thresholds (version lag amber ≥ 2 / red ≥ 4; sentiment spike 20% vs 7-day mean;
      growth stagnation window 14 days; burn-rate alert 90% projected; growth window 30/90 days) are
      surfaced as tunable defaults with their data window + aggregation stated, not hard-coded.

## Dependencies

- **Blocked by:** EPIC-001 (Generative Dashboard composition/lifecycle machinery renders these
      categories). Constitution Engine GA for CE-sourced stories. Build Engine GA (S4, Build rows of
      S7/S12, per-run of S3), Events Engine GA (automation rows of S3/S8), Graph Explorer realtime
      presence contract — currently not contracted, a Phase-2 Explorer deliverable — for S9 realtime
      sub-widgets.
- **Blocks:** Nothing downstream within the platform; this epic is a leaf consumer of engine contracts.

## Technical Notes

- A category's availability is keyed strictly to its source engine reaching GA; Phase 3 is a single
      "per source-engine GA" phase, not three engine-aligned phases.
- E2-S3 token dimension and E2-S8 connector-health rows ship real data in Phase 1 (billing + connector
      health); only their automation/per-run dimensions remain Phase 3.
- Sentiment (S10) runs a periodic `claude-haiku-4-5` NLP job with PII scrubbed before the model;
      daily numeric score = mean of per-entry +1/0/−1 classifications so a percentage drop is computable.
- Compliance contraventions (S5), issues (S7), and onboarding items (S15) deep-link to entities via
      `CE-READ-1` (`/resource/{iri}`). The agent activity feed (S11) keys on the canonical principal IRI
      from `PLAT-IDENTITY-1`.
- The ontology-health (S1), completeness (S2), issues (S7), growth (S13), and onboarding-progress (S15)
      widgets read `CE-METRICS-1` (`entity_count_by_kind`) and per-kind coverage over the **process-centric
      BPMO framework** the Constitution Engine ships (`CE-READ-1`: `Process`, `Activity`, `Event`,
      `DataAsset`/`Field`, `System`, `Service`, `BusinessCapability`, `BusinessDomain`, `Policy`, `Goal`,
      `Actor`, `Concept`/`Class`, plus its relationship set). "Per kind" therefore ranges over whatever
      kinds CE registers — the shipped BPMO kinds and any client-defined extensions — never a fixed
      count: the BPMO is a framework, not a populated taxonomy (decision A1). Onboarding-progress
      "ontology populated" counts ≥ 1 instance against the registered kinds, not a hard-coded list.

---
*Generated by Weave Architect agent.*

---
type: Task
title: "Task: TASK-014 — Role→Starter-Widget Mapping handed to Platform"
description: "E3-S1's sibling Should-Have: the per-path starter-widget-set mapping with
  engine-availability tags, exposed as configuration for Platform E1-S6 to consume. Onboarding
  renders nothing; the Business CE-METRICS-1 tile is tagged m2 (graceful-omit)."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Should Have
entity: onboarding
epic: EPIC-003
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-003", "TASK-006"]
unlocks: []
adr_refs: [ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E3-S2 / FR-015

## Story

As a new user, I want my Dashboard's starter widgets to match my role from first load, so the
Dashboard makes sense the moment I land — with onboarding supplying the mapping and Platform
owning the rendering (single source of truth).

## Scope Note

Configuration hand-off only. Ships the mapping in TASK-003's config package (this task finalises
and publishes it to Platform's consumption seam): Business → ontology health + graph
completeness (both tagged `m2`, CE-METRICS-1-backed); Technical → token spend + active projects
+ agent activity; Compliance → compliance status + audit feed + self-improvement findings;
Admin → RBAC coverage + connector health + onboarding progress. Every widget carries an
engine-availability tag; the M1 window exposes CE-sourced widgets only — Platform E1-S6 omits
unavailable ones. **Onboarding renders and removes nothing** (Platform PRD E1-S6 / FR-012 owns
that). The mapping keys off the same resolved path as everything else (TASK-006) — the epic's
cannot-disagree AC.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-014-01 | WHEN Platform resolves starter widgets for a user THE SYSTEM SHALL supply the mapping for the user's resolved path — the same path that drives tours/exercises/milestones (EPIC-003 epic AC). |
| AC-014-02 | WHEN the mapping is read THE SYSTEM SHALL provide, per path, the widget list from FR-015's AC verbatim, each entry carrying an engine-availability tag. |
| AC-014-03 | IF a mapped widget's source engine has not shipped THEN THE SYSTEM SHALL enable Platform to omit it via the tag; the Business ontology-health/completeness tiles SHALL be tagged `m2` (CE-METRICS-1) and gracefully omitted until CE M2 (E3-S2). |
| AC-014-04 | WHEN the mapping changes THE SYSTEM SHALL fail CI if any entry lacks an availability tag or names an unknown path (TASK-003 check machinery). |

## API Contracts

None published — the mapping is **configuration consumed by Platform E1-S6**, not a contract
(PRD §2.5 "Provided: none"). Cites `CE-METRICS-1` availability (M2) by tag only.

## Diagram

None needed — a data table with a consumption seam; shape in data-model.md §Content Config
Schemas (widget mapping).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Mapping is config, Platform renders | Single source of truth for widget rendering = Platform | FR-015 / PRD §2.7 |
| Availability tags, not conditional lists | One mapping serves M1/M2/post-v1; Platform filters | E3-S2 resolve-by-default #5 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Mapping shape: 4 paths × FR-015 widget lists; tags present | AC-014-02/04 |
| Unit | CE-METRICS-1 tiles tagged `m2` | AC-014-03 |
| Integration | Consumption seam: Platform-side read returns the mapping for a resolved path (stub Platform reader) | AC-014-01 |

## Dependencies

- **blocked_by**: TASK-003 (schema + check machinery), TASK-006 (path source)
- **unlocks**: none (terminal hand-off)

## Cost Estimate

**XS** — a reviewed data table plus its checks; the value is fidelity to FR-015 and the tags.

## DoR Checklist

- [ ] Platform E1-S6 consumption seam agreed (import vs endpoint — Platform's call)
- [ ] FR-015 widget lists confirmed current with the Platform PRD

## DoD Checklist

- [ ] All ACs pass; mapping merged in the config package
- [ ] Platform team sign-off recorded on the seam
- [ ] CI checks green (tags, paths)

## Implementation Hints

Keep it a plain exported const beside the path-mapping table — if Platform prefers an endpoint
later, wrap the same const; do not build the endpoint speculatively.

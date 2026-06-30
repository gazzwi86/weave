---
id: EPIC-001
type: epic
entity: onboarding
title: Hammerbarn Demo Workspace
status: backlog
phase: 1
priority: must
mvp: false
depends_on: [CE-READ-1, CE-WRITE-1, CE-VERSION-1, GE-CANVAS-1, PLAT-SETTINGS-1, PLAT-IDENTITY-1, PLAT-AUDIT-1, BE-ARTEFACT-1, EA-AUTOMATION-1]
blocks: [EPIC-002, EPIC-003, EPIC-004, EPIC-005]
provides: []
consumes: [CE-READ-1, CE-WRITE-1, CE-VERSION-1, GE-CANVAS-1, PLAT-SETTINGS-1, PLAT-IDENTITY-1, PLAT-AUDIT-1, BE-ARTEFACT-1, EA-AUTOMATION-1]
prd_ref: ../prd.md#epic-1-hammerbarn-demo-workspace
owner: gazzwi86
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
coverage: n/a
---

# Epic: EPIC-001 - Hammerbarn Demo Workspace

## Overview

**Phase:** Phase 1 (MVP-window, parallel — not a thin-loop MVP exit gate) — CE/Explorer seed areas only, writable sandbox · Build/Events seed areas straddle into Phase 2 (Build + Events GA)
(Build/Events GA) for the Build project + Kitchen Designer app + example automations as live
seed areas
**PRD Reference:** [prd.md](../prd.md#epic-1-hammerbarn-demo-workspace)
**Status:** Backlog
**Priority:** Must Have

## Description

Delivers the fully-modelled Hammerbarn example company as a demo workspace present in every new
user's switcher with no setup. Each user gets a per-user writable sandbox copy keyed by
`(tenant_id, user_id)` that persists server-side across sessions, can be manually reset to the
canonical state, and isolates every hands-on edit from the canonical dataset and from every other
user. This is the "see what good looks like" surface the rest of onboarding builds on.

## User Stories

| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| E1-S1 | Explore a fully-modelled example company on first sign-in | Backlog | Must Have |
| E1-S2 | Reset the writable demo sandbox to its original state | Backlog | Must Have |
| E1-S3 | Hands-on edits land in the writable sandbox only | Backlog | Must Have |

## Acceptance Criteria (Epic Level)

- [ ] All three isolation boundaries hold **simultaneously**: a per-user sandbox keyed by
      `(tenant_id, user_id)` (S2), sandbox-vs-canonical 403 rejection (S3), and sandbox-vs-real-
      tenant separation — no single story passing guarantees the set, so the cross-story seam is
      verified as a whole.
- [ ] The cross-tenant-read test passes: given a tenant-A / user-A JWT, an unscoped sandbox query
      returns **zero** tenant-B and zero other-user triples (PRD §6).
- [ ] Across S1 (render), S2 (reset), and S3 (write), the "Demo — fictional data" label and the
      "Practice mode" banner remain present on every demo screen — a render path added by one
      story does not silently omit them.
- [ ] Areas owned by a not-yet-GA engine (Build/Events at MVP) are feature-flagged off with a
      "Coming soon" note; the workspace never renders a broken or empty Build/Automate tab.

## Dependencies

- **Blocked by:** PLAT-SETTINGS-1 (per-user copy / isolation topology, OQ-02 — gates the writable
      sandbox P0); CE-WRITE-1 (live-pipeline seed authoring, sandbox `target=draft` writes,
      seed re-apply on reset); CE-READ-1 (`?version=latest` render of ontology/glossary/brand/
      governance); GE-CANVAS-1 (Explorer canvas render); PLAT-AUDIT-1 (canonical-write-rejection
      audit). Phase 2: BE-ARTEFACT-1 (Kitchen Designer project/app) and EA-AUTOMATION-1 (example
      automations).
- **Blocks:** none directly (onboarding is a terminal consumer). Within onboarding, the writable
      sandbox underpins EPIC-004 (Hands-On Exercises) and EPIC-005 (Activation).

## Technical Notes

The Hammerbarn seed is **authored content built as a live pipeline** (decision E2) — CE produces
ontology/glossary/brand/governance via CE-WRITE-1, Build the Kitchen Designer project/app, Events
the automations — not a static migration snapshot, so the demo stays in step with the real
product. Every Hammerbarn entity class maps onto the process-centric **BPMO framework**
kinds/relationships (CE-READ-1) — **Process** is the spine, edging out to Activity (steps), Event
(triggers), Actor (`performedBy`), System, Service, DataAsset, BusinessCapability, BusinessDomain,
Goal, and Policy. The six named business processes (Goods inward, Stock mgmt, Customer order, Staff
onboarding, Supplier mgmt, Store ops) are **Process** — with Activity steps, Event triggers, and
`performedBy` Actors — **not** BusinessCapability; instance categories like Product/Store are Class
definitions punned with Concept (decision B1), not new kinds. Counts ("8 product types", "40+
glossary terms") are content targets owned by the content admin, not contractual constants. Isolation topology
(named-graph-per-`(tenant,user)` + query-rewriting vs store-per-tenant) is deferred to OQ-02 at
tech spec, but the isolation expectation and the cross-tenant-read test are pinned in PRD §6. The
sandbox reset op targets a default ≤ 30 s (tunable, decision E1) and must leave the sandbox in a
known state — never partial — on failure.

---
*Generated by Weave Architect agent.*

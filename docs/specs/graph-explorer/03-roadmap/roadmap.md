---
type: Roadmap
title: Graph Explorer — Roadmap
description: "Phased delivery plan for the Weave Graph Explorer: an MVP visualise-and-edit canvas (force + c4) over the Constitution Engine graph with async share, then realtime collaboration in Phase 2."
tags: [graph-explorer, 03-roadmap]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/graph-explorer/03-roadmap/roadmap.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# Roadmap: Graph Explorer

**Brief:** [brief.md](../01-brief/brief.md) · **PRD:** [prd.md](../02-prd/prd.md)
**Program roadmap:** [../../_program-roadmap.md](../../_program-roadmap.md)
**Status:** Draft

## Position in the build order

Weave build order: **Platform shell → Constitution → Graph Explorer → Build → Events → Onboarding**.
This engine is **#3** — the first surface on the platform shell after the Constitution Engine, and the
visualise half of the MVP thin loop (Platform shell + CE model + Explorer visualise + a narrow Build
slice that generates one artefact, proving model→generate).

**Depends on** (all upstream of #3 in the build order, so available when Explorer starts; consumed by
contract ID — see [_inter-engine-contracts.md](../../_inter-engine-contracts.md)):

- Constitution Engine (#2): `CE-READ-1` (graph/node-kinds/version load, SPARQL property-path
  traversal), `CE-WRITE-1` (all authoritative node/edge writes; server-side authz boundary),
  `CE-DIFF-1` (server diff incl. edge mods), `CE-VERSION-1` (version list + canonical lag).
  `CE-EVENT-1` (live graph-change stream) is **the one engine-gated item**: MVP ships the poll
  fallback over `CE-READ-1`; the live-stream upgrade activates when `CE-EVENT-1` ships.
- Platform shell (#1): `PLAT-NOTIFY-1` (share notifications), `PLAT-SETTINGS-1` (tenancy/RBAC cascade,
  workspace-admin governance), `PLAT-IDENTITY-1` (agent-initiated write principals), `PLAT-AUDIT-1`
  (read-only audit `seq` correlation).

**Unblocks:** Build Engine (#4) — Explorer **provides** `GE-CANVAS-1` (embeddable `force|c4` canvas);
Build embeds the project-scoped slice and writes project architecture back via `CE-WRITE-1`. Work that
is contract-unblocked may run in parallel — see the program roadmap.

## Phases

```mermaid
gantt
    title Graph Explorer Roadmap
    dateFormat YYYY-MM-DD
    section Phase 1 (MVP — visualise + edit + async share)
        E1 Whole-Company Canvas      :e1, 2026-01-01, 8d
        E8 Version Views & Diff      :e8, after e1, 5d
        E2 Drill-In & Domain Focus   :e2, after e1, 5d
        E3 Filters & Layers          :e3, after e2, 5d
        E4 Visual Overlays           :e4, after e3, 5d
        E5 Visual Editing (CE-WRITE) :e5, after e2, 7d
        E7 Saved Views & Layout      :e7, after e4, 5d
        E6 Async Share & Comments    :e6, after e7, 4d
        E9 GE-CANVAS-1 embeddable    :e9, after e5, 5d
        HITL: Phase-1 boundary gate  :milestone, m1, after e6, 0d
    section Phase 2 (Realtime collaboration)
        E6 Realtime co-edit/presence :p2a, after m1, 8d
        E6 Follow-me + CE-EVENT-1    :p2b, after p2a, 5d
        HITL: Phase-2 boundary gate  :milestone, m2, after p2b, 0d
```

---

### Phase 1: MVP — Visualise, Edit & Async Share  ·  MVP

**Goal:** A user opens the Explorer and sees the company operating model as a force-directed canvas;
finds, spotlights, filters, overlays and drills into it without RDF/SPARQL; makes SHACL-validated
visual edits through `CE-WRITE-1`; views/diffs published versions; saves and async-shares team views;
and the embeddable `GE-CANVAS-1` (`force|c4`) is available for the Build Engine. This is the
*visualise* half of the MVP thin loop — single-user editing plus asynchronous sharing, **no realtime
co-editing** (D1).

**Epics:**

| Epic | Description | Stories | Priority | MVP? |
|------|-------------|---------|----------|------|
| EPIC-001 (E1) | Whole-Company Canvas (force mode): load draft graph via `CE-READ-1`, colour by node-kind, pan/zoom, spotlight, search, server-side layout persistence | 5 | Must Have | yes |
| EPIC-002 (E2) | Drill-In & Domain Focus: focus a domain, expand/collapse neighbourhood, impact/dependency trace via CE SPARQL property-path | 3 | Must Have | yes |
| EPIC-003 (E3) | Filters & Layers: entity-type and relationship-type toggles, client-side property filter, governed-content layers | 4 | Must/Should Have | yes |
| EPIC-004 (E4) | Visual Overlays: fixed heatmap mappings, version diff overlay (`CE-DIFF-1`), pinned impact, domain colouring | 4 | Must/Should Have | yes |
| EPIC-005 (E5) | Visual Editing on the Canvas: add/edit/delete node, draw edge — all committed via `CE-WRITE-1` with optimistic rollback | 4 | Must Have | yes |
| EPIC-006 (E6) | Async Share & Comments (MVP stories only — S1 share, S2 comments, S3 live-refresh poll fallback) | 3 | Must/Should Have | yes |
| EPIC-007 (E7) | Saved Views & Layout (server-side, team-shared, D2): save view, workspace-shared library, featured pins | 3 | Must/Should Have | yes |
| EPIC-008 (E8) | Version Views & Diff: view a published version read-only (`CE-VERSION-1`/`CE-READ-1`), diff two versions (`CE-DIFF-1`) | 2 | Must Have | yes |
| EPIC-009 (E9) | Embeddable Canvas Component `GE-CANVAS-1` (`force` + `c4` modes) — provided to Build Engine | 1 | window¹ |

> **¹ MVP-exit gates vs MVP-window (audit M2).** Only **E1 (render)** + **E8 (diff)** are thin-loop
> MVP *exit gates* — the visualise step the program MVP depends on. **E5 (visual editing), E6 (async
> share), E7 (saved views), E9 (`GE-CANVAS-1`)** ship in the MVP *window* but are **not** thin-loop
> exit gates and have no MVP consumer — `GE-CANVAS-1`'s first consumer is Build Phase 2, so **E9 may
> slip to Phase 2 without blocking the MVP**. Scheduled here for parallelism, not as gates.

> Epic count: 9 (E6 contributes 3 of its 5 stories here; the remaining 2 are Phase 2). FR coverage:
> FR-001–FR-025 and FR-028–FR-034. FR-025 ships as **poll fallback only** in this phase; the
> `CE-EVENT-1` live-stream upgrade lands when CE-EVENT-1 ships.

**Entry criteria (Definition of Ready):**

- [ ] PRD approved; Phase-1 tech spec approved (C4, OpenAPI/component contract for `GE-CANVAS-1`,
      data model for Explorer-owned Aurora tables — views/layout/comments).
- [ ] Tasks decomposed; each task brief passes the DoR gate (`arch-dor`).
- [ ] Upstream contracts available and stubbable: `CE-READ-1`, `CE-WRITE-1`, `CE-DIFF-1`,
      `CE-VERSION-1` (Constitution Engine #2 shipped), and `PLAT-NOTIFY-1`, `PLAT-SETTINGS-1`,
      `PLAT-IDENTITY-1`, `PLAT-AUDIT-1` (Platform shell #1 shipped). Integration tests run against CE
      stubs until live.
- [ ] OQ-01 benchmark harness defined (browser, hardware, node/edge count, fps sampling) so the
      performance exit criterion is measurable rather than asserted.

**Exit criteria (EARS, measurable, human-signed):**

- [ ] WHEN an authenticated viewer opens the Explorer THE SYSTEM SHALL render the current draft graph
      via `CE-READ-1` as a Cytoscape/fcose force canvas, coloured by CE node-kind, with first
      interactive render within **default ≤ 3 s at 1k nodes / ≤ 8 s at 10k nodes (p95), tunable** —
      verified by the OQ-01 performance harness against a realistic graph.
- [ ] WHEN a business-role (viewer) user searches and clicks a result THE SYSTEM SHALL centre and
      spotlight that node and show its label/type/key-props **without exposing a raw IRI** — verified
      by E1-S3/E1-S4 E2E test.
- [ ] WHEN a BA-role user double-clicks the canvas to add a node THE SYSTEM SHALL commit it via
      `CE-WRITE-1`, surface any `422` SHACL violation as human-readable text, and roll back the
      optimistic node on a `CE-WRITE-1` timeout (**default 10 s, tunable**) with no orphan left on
      canvas — verified by E5-S1 integration test against a CE stub returning `201` and `422`.
- [ ] WHEN a user requests a diff of two published versions THE SYSTEM SHALL call `CE-DIFF-1` and
      render added (green) / removed (red, default 0.35 opacity, tunable) / modified-incl-edges
      (amber), or "no differences" when identical — verified by E4-S2/E8-S2 test.
- [ ] WHEN a user saves a team view (filters + overlays + domain focus + **server-side layout**) and
      shares it THE SYSTEM SHALL notify eligible recipients via `PLAT-NOTIFY-1`, exclude recipients
      lacking graph access (no leak), and reproduce the same layout for a different workspace user —
      verified by E6-S1/E7-S1 integration test.
- [ ] WHEN the Build Engine mounts `GE-CANVAS-1` with `{filterByIri, mode}` in both `force` and `c4`
      modes THE SYSTEM SHALL render the project-scoped slice and write a project-architecture edit back
      via `CE-WRITE-1` — verified by the `GE-CANVAS-1` contract conformance test.
- [ ] WHEN any Explorer read is issued under a tenant-A JWT THE SYSTEM SHALL return **zero tenant-B
      rows/triples** across graph load, Saved Views, comments, and diff — verified by the required
      cross-tenant isolation test (§6).
- [ ] Coverage ≥ 80% (default, tunable) · mutation ≥ 70% (default, tunable) · 0 blocking bugs · zero
      axe-core violations on the non-canvas UI in CI (default, tunable).
- [ ] **Measurable artefacts delivered:** the deployed Explorer module, the published `GE-CANVAS-1`
      component contract conformance report, the OQ-01 performance-benchmark report, and the
      cross-tenant isolation test report.
- [ ] **Human sign-off recorded** (always the final exit criterion).

**HITL gates (configurable for this phase — declare which are active):**

| Gate | Active? | Approver | Blocks |
|------|---------|----------|--------|
| Spec-approval (PO/stakeholder sign-off) | **mandatory** | PO + EA stakeholder | phase start |
| Phase-boundary ceremony (security-review + mutation + doc-gen) | yes | PO + Tech lead | phase-2 |
| Pre-AWS-deploy (full local pyramid + gates green → approve → dev-AWS smoke) | yes | Tech lead | deploy |
| Publish/generate (GE-CANVAS-1 component release to Build) | yes (scoped to `GE-CANVAS-1` only) | PO + Tech lead | GE-CANVAS-1 release |

> HITL gates are project/workspace-configurable; only spec-approval is globally mandatory. The
> pre-AWS-deploy gate enforces `_dev-environment.md §4`: full local pyramid + all quality gates green
> → HITL approval → dev-AWS smoke → promote. The publish/generate gate is **scoped narrowly to the
> `GE-CANVAS-1` component release** (Explorer's only "released artefact"); it is **not** an ontology
> publish (that is CE's) nor a generated-artefact release (that is Build's).

**Phase-gate metadata** (evaluated by the phase-gate Stop hook / `/goal` condition):

```
phase: 1
gate_id: graph-explorer-gate-1
condition: all_exit_criteria_met
approver: PO + Tech lead
blocks: phase-2
```

---

### Phase 2: Realtime Collaboration

**Goal:** Figma-style live multi-user collaboration on the canvas — presence, cursors, concurrent
drags, follow-me — built on a CRDT (Yjs), with authoritative writes still serialised through
`CE-WRITE-1`; plus the `CE-EVENT-1` live-stream upgrade of live-refresh (replacing the Phase-1 poll
fallback). **Dependencies:** Phase 1 gate passed; CRDT sync transport + scaling decided (OQ-02/OQ-07);
`CE-EVENT-1` shipped.

**Epics:**

| Epic | Description | Stories | Priority | MVP? |
|------|-------------|---------|----------|------|
| EPIC-006 (E6, Phase-2 stories) | Realtime co-editing + presence/cursors (E6-S4, Yjs CRDT) and workshop "Follow me" viewport sync (E6-S5); plus the `CE-EVENT-1` live-stream upgrade of FR-025 live-refresh | 2 | Won't (MVP) / Must+Should (P2) | no |

> FR coverage: FR-026 (realtime co-edit + presence), FR-027 (follow-me), and the live-stream half of
> FR-025 (CE-EVENT-1). All Phase-2 thresholds are "default X, tunable".

**Entry criteria (Definition of Ready):**

- [ ] Phase 1 gate passed and human sign-off recorded.
- [ ] Phase-2 PRD section + tech spec approved (CRDT sync transport, scaling, tenant-scoped sync rooms).
- [ ] Tasks decomposed; each task brief passes the DoR gate.
- [ ] OQ-02 (Yjs sync transport + scaling) and OQ-07 (follow-me transport) resolved at tech spec;
      `CE-EVENT-1` shipped and subscribable.

**Exit criteria (EARS, measurable, human-signed):**

- [ ] WHEN ≥ 2 users are active in a live session (target **default 5 concurrent, tunable**) THE SYSTEM
      SHALL show each other's cursors and reflect node drags with **default ≤ 500 ms p95 latency,
      tunable**, while authoritative writes still serialise through `CE-WRITE-1` — verified by a
      multi-user load + convergence test.
- [ ] WHEN a client connects to a CRDT sync room THE SYSTEM SHALL validate the Cognito JWT tenant claim
      against the room id and **reject a tenant mismatch at connect** (client-side gating is never the
      boundary) — verified by a sync-room cross-tenant rejection test.
- [ ] WHEN the sync transport drops mid-session and reconnects THE SYSTEM SHALL replay local edits and
      converge with **no lost updates** (duplicate-IRI creates reconcile at `CE-WRITE-1`) — verified by
      a reconnect/convergence test.
- [ ] WHEN `CE-EVENT-1` emits a graph-change event THE SYSTEM SHALL reconcile the affected element in
      place (replacing the Phase-1 poll fallback) with a "graph updated" indicator — verified by an
      event-stream integration test.
- [ ] Coverage ≥ 80% (default, tunable) · mutation ≥ 70% (default, tunable) · 0 blocking bugs.
- [ ] **Measurable artefact delivered:** the multi-user convergence + latency test report at the
      default-5-concurrent tier, and the sync-room tenant-isolation test report.
- [ ] **Human sign-off recorded** (always the final exit criterion).

**HITL gates (configurable for this phase — declare which are active):**

| Gate | Active? | Approver | Blocks |
|------|---------|----------|--------|
| Spec-approval (PO/stakeholder sign-off) | **mandatory** | PO + EA stakeholder | phase start |
| Phase-boundary ceremony (security-review + mutation + doc-gen) | yes | PO + Tech lead | GA |
| Pre-AWS-deploy (full local pyramid + gates green → approve → dev-AWS smoke) | yes | Tech lead | deploy |
| Publish/generate (ontology publish / artefact release) | no (N/A — no new released artefact this phase) | — | — |

> The Phase-2 security-review weight is higher: a new network-facing CRDT sync server with
> tenant-scoped rooms and any sync-server credentials in **AWS Secrets Manager only** (never `.env`).

**Phase-gate metadata** (evaluated by the phase-gate Stop hook / `/goal` condition):

```
phase: 2
gate_id: graph-explorer-gate-2
condition: all_exit_criteria_met
approver: PO + Tech lead
blocks: GA
```

---

## HITL gate summary

| Gate | After phase | Approval criteria | Approver |
|------|-------------|-------------------|----------|
| Spec-approval | Before each phase | PRD/tech-spec approved (mandatory, globally) | PO + EA stakeholder |
| Gate 1 (phase-boundary + pre-deploy + GE-CANVAS-1 publish) | Phase 1 | All Phase-1 EARS exit criteria met (incl. OQ-01 perf, cross-tenant isolation, GE-CANVAS-1 conformance) + coverage/mutation floors + human sign-off | PO + Tech lead |
| Gate 2 (phase-boundary + pre-deploy) | Phase 2 | All Phase-2 EARS exit criteria met (multi-user convergence, sync-room tenant isolation, CE-EVENT-1 live refresh) + floors + human sign-off | PO + Tech lead |

> All numeric thresholds above are "default X, tunable" per workspace/project. Cross-engine
> dependencies cite contract IDs from [_inter-engine-contracts.md](../../_inter-engine-contracts.md).

---
*Generated by Weave PO agent. Review and approve before proceeding to Technical Architecture.*

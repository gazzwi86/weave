---
type: Design
title: "Weave — Jobs-to-be-Done map (per surface)"
description: "The job each screen is hired for, who hires it, the moment of hire, success criteria,
  and the best-in-class reference pattern — the lens for design QA and for writing design
  requirements into task briefs."
tags: [design, jtbd, ux]
status: "Draft — WS2 deliverable, pending user review"
timestamp: 2026-07-09T00:00:00Z
resource: docs/design/jtbd.md
source: WS2 design assessment (2026-07-09)
owner: gazzwi86
---

# Jobs-to-be-Done — per surface

Format per surface: **Job statement** (When… I want to… so I can…), hirer (persona), success
criteria (what must be true for the job to feel done), reference pattern. Personas from
`docs/specs/weave/personas.md`; contract IDs cited where the job binds to one.

## Home / Dashboard

- **Job:** When I open Weave at the start of a working session, I want to see what changed and
  what needs me, so I can decide where to go without hunting.
- **Hirer:** every tenant role (FR-047 — each member lands here).
- **Success:** in <5s I can answer "did anything change?" (model versions, build runs, conformance)
  and "is anything waiting on me?"; one click reaches the change itself.
- **Reference:** Vercel/Linear home — activity feed + a few KPI tiles, not a BI wall. Tiles are
  CE-sourced (`CE-READ-1`/`CE-METRICS-1`), activity is audit-sourced (`PLAT-AUDIT-1`).

## Constitution → Overview

- **Job:** When I'm responsible for the model, I want a health snapshot (size, coverage, drafts vs
  published, recent edits), so I can spot gaps and stale areas.
- **Hirer:** enterprise architect, data steward.
- **Success:** kind counts, unused kinds, draft/published split, last-edit recency — each linking
  into the filtered surface that fixes it.
- **Reference:** database "schema health" pages; Foundry ontology overview.

## Constitution → Instances / Data

- **Job:** When I need to know what the company model says about X, I want to browse and search
  entities by kind and relationship, so I can read, verify, and correct the model.
- **Hirer:** analyst/SME (read+author), data steward (curate).
- **Success:** list/table per kind with search, sort, and relationship counts; entity detail with
  properties + edges + provenance; author (chat, guided form) is an *action on* this surface, not
  a replacement for it. All writes SHACL-guarded via `CE-WRITE-1` with inline 422 rendering.
- **Reference:** Airtable/Notion database views; Foundry object explorer.

## Constitution → Explore (canvas)

- **Job:** When I want to understand how things connect (or show someone), I want a legible,
  focusable live graph, so I can trace dependencies and tell the story visually.
- **Hirer:** enterprise architect (analysis), workspace admin (demo/story-telling).
- **Success:** loads fit-to-viewport and legible at any node count; kind legend always visible;
  search → spotlight; click → inspector (props/edges/PROV, edit entry); `rdf:type` noise hidden;
  named edges labelled by their label, not IRI. (`GE-CANVAS-1` embed.)
- **Reference:** Neo4j Bloom (search-first, legend, inspector), Obsidian graph (calm default).

## Constitution → Query

- **Job:** When I have a question the nav can't answer, I want to ask in plain language and see
  the answer grounded in the graph, so I can trust it and go deeper.
- **Hirer:** analyst/SME first; enterprise architect for the SPARQL escape hatch.
- **Success:** ask → visible progress → answer rows + the generated SPARQL (inspectable) +
  grounding highlighted on a mini-canvas; failure states say *why* (no provider, no match) and
  offer example questions. SPARQL editor stays for experts (SELECT-only, versioned).
- **Reference:** Neo4j Browser (table/graph toggle on every result) + modern AI-search progress
  affordances.

## Build → Request application

- **Job:** When the model is good enough to act on, I want to commission an application grounded
  in specific entities, so the factory builds against the truth I just curated.
- **Hirer:** engineer, enterprise architect.
- **Success:** name + grounding-entity picker (from the graph) + target repo + run mode; after
  submit, a visible request record with status and a provenance link (`BE-ARTEFACT-1`).
- **Reference:** Vercel "new project" flow — few fields, strong defaults, immediate visible result.

## Audit trail (dashboard + logs)

- **Job:** When something happened (or an auditor asks), I want to reconstruct who/what/when with
  proof, so I can answer with evidence rather than assertion.
- **Hirer:** compliance officer, workspace admin; others see own activity.
- **Success:** dashboard = tiles + trend chart (volume, by-engine, agent-vs-human, error rate) each
  drilling into pre-filtered logs; logs = 7-dimension filters, human-readable actor + relative
  time (raw URN/ISO on expand), chain-verify + export always visible.
- **Reference:** Stripe events + GitHub audit log.

## Compliance

- **Job:** When I own conformance, I want current SHACL status and month-over-month movement, so I
  can prove the model is governed.
- **Hirer:** compliance officer.
- **Success:** conformance status, rejects trend, rule inventory (kinds & shapes) — tiles + charts,
  linking to the shapes and the offending writes.

## Settings

- **Job:** When I administer the company workspace, I want members/roles, model routing, budgets,
  and notification prefs in one predictable place, so I can govern without a runbook.
- **Hirer:** workspace admin (tenant scope); super-admin sees provisioning only.
- **Success:** Members (10 roles), Models & AI, Billing & budgets, Notifications prefs
  (`PLAT-NOTIFY-1`), Integrations (v1 pill), Workspaces (super-admin). Tenancy language matches
  workspace ≡ company.

## Marketing index

- **Job:** When a prospect lands, I want to grasp what Weave is and see it working, so I can decide
  to try it or book a demo.
- **Success:** hero with a real product visual (graph canvas), three-step how-it-works with real
  screenshots, working Log in / Get started.

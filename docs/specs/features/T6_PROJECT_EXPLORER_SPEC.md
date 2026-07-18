---
title: "T6 — Project-scoped Explorer: a project-centric graph view that builds out and retires the model"
type: feature-spec
status: draft
created: 2026-07-18
owner: unassigned
source: T4 coverage-reconciliation decision (2026-07-18); user clarification; decision_home-and-canvas-surfaces
---

# T6 — Project-scoped Explorer (`/build/projects/{id}/canvas`, replacing `ge-canvas-preview`)

## 1. Intent (user's words, 2026-07-18)
> "A view of the Explorer that is project-centric and can connect the project out and build out /
> retire systems, processes etc. as the project is delivered/complete... a more focused, filtered
> view... The aim is to have people build out and augment the processes as they build a new app or
> piece of functionality or data pipeline."

So T6 is **the Graph Explorer, scoped to one Build project** — showing only the entities
(processes, systems, data, actors, capabilities…) that are **created by, affected by, or relevant
to** that project, and letting the operator **grow and prune the model as the project is
delivered**: connect the project outward into the company graph, add/augment processes and
systems, and **retire** things the project decommissions.

## 2. Current state
- `/build/ge-canvas-preview` (`app/build/ge-canvas-preview/page.tsx`, ~49 lines) is a bare preview
  surface, currently top-level in the nav. Per the T4 decision it is KEPT but rebuilt as this
  project-scoped Explorer and **moved into the build-project nav** (per project, not top-level).
- The full Explorer already exists: `/explorer` + `components/explorer/*` (Cytoscape/fcose canvas,
  ControlDock filters/layers/overlays/versions, KPI strip, node CRUD via CE-WRITE-1, AskBar).
- Build projects: `/build/projects/{id}` with tasks/decisions/board/settings sub-routes.
- Ontology is BPMO (processes, activities, events, actors, policies, domains, capabilities,
  systems, services, data assets). Instances live in the tenant graph.

## 3. Scope (the real feature — spec now, build later)
### 3.1 Route + placement
- New route `/build/projects/{id}/canvas` (or `/model`), linked from the build-project nav
  alongside Tasks/Decisions/Board/Settings. Retire `/build/ge-canvas-preview` (redirect to the
  new project canvas or delist).

### 3.2 Project-scoped filtering
- The canvas renders the SAME Explorer graph but **filtered to the project's scope**. Scope =
  the set of entities linked to the project. Requires a **project↔entity linkage** in the model:
  - a relation (e.g. `weave:affectsEntity` / `weave:createdByProject` / `weave:relevantToProject`)
    connecting a project to the BPMO entities it creates / affects / touches, plus provenance
    (PROV-O) for who/when.
  - Backend: a scoped read — `GET /api/build/projects/{id}/graph` (or a SPARQL pattern) returning
    the project's subgraph + a configurable "N hops out into the parent graph" so the operator can
    see how the project connects outward.
- Optional (recorded, not required v1): a **project-level ontology** modelled as an overlay linked
  to the parent company graph (the project can declare its own local model that composes into the
  company model).

### 3.3 Build-out and retire (the differentiator)
- From this canvas the operator can **create/augment** BPMO entities and relationships (reuse the
  existing Explorer edit controller + CE-WRITE-1 write proxy / quick-add / draw-edge) — but every
  create is **attributed to the project** (stamps the project-linkage relation + provenance).
- **Retire**: mark an entity/process/system as retired/decommissioned by this project (a lifecycle
  state on the entity, e.g. `weave:lifecycleState = "retired"`, with the retiring project + date in
  provenance). Retired nodes render visually distinct (dimmed/strikethrough) and are excluded from
  active views by default. This mirrors "systems/processes are decommissioned as the project
  completes."
- As the project moves through its lifecycle (speccing → building → live → complete), the canvas is
  the operator's workspace for evolving the model to match reality.

### 3.4 Reuse vs new
- REUSE: the whole Explorer canvas stack (rendering, ControlDock, layout persistence, edit
  controller, AskBar, overlays). Ideally parameterise the existing Explorer with a `projectScope`
  prop rather than forking a second canvas.
- NEW: the project↔entity linkage relation + provenance; the scoped read endpoint; the retire /
  lifecycle-state affordance; project-attribution on writes; the build-project nav entry.

## 4. Non-goals (v1)
- Full project-level ontology federation (recorded as a future door, not built v1).
- Auto-inference of project scope — scope is explicit via the linkage relation, populated as the
  operator builds out.

## 5. Acceptance criteria (full feature)
- `/build/projects/{id}/canvas` renders the Explorer filtered to that project's linked entities,
  with an adjustable "hops out" to show connections into the company graph.
- Creating an entity/edge here attributes it to the project (linkage + provenance).
- An entity can be retired-by-project; retired nodes are visually distinct and filtered by default.
- Linked from the build-project nav; `ge-canvas-preview` retired.
- Contract/ontology additions documented (new relation(s), lifecycle state, scoped endpoint);
  SHACL shapes + PROV updated; tsc/lint/unit/e2e green.

## 6. Dependencies / open questions
- Depends on a **project↔entity linkage** in the ontology (does `projects` even carry the needed
  scope columns? cf. `project_projects-domain-id-gap` — projects had no domain_id; a similar gap
  may exist for entity linkage). Confirm before build.
- Relation to G19 (canvas node-click under overlay chrome) — fix as part of canvas work.

## 7. Rough sizing
Feature-scale, ~1+ focused day (ontology + backend + canvas parameterisation + lifecycle UI). Ships
after a **UI placeholder** (see placeholder task) that puts the project-canvas nav entry + an
"in progress" surface in place now.

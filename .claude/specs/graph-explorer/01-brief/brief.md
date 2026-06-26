# Brief: Graph Explorer

## Mission Statement

We are building the Weave Graph Explorer — the visual, collaborative canvas onto the company
graph — so that business and technical users can see their entire operating model as a
navigable, force-directed network, drill into any part of it, and explore and shape it
together in real time, Figma-style. It turns the Constitution Engine's formal RDF/OWL model
into something a whole organisation can actually see, understand, and work on together,
rather than a model only experts can read.

## Problem

A formal model of the business is only valuable if people can actually see and navigate it —
and today they cannot.

- **Formal models are unreadable to humans.** An RDF/OWL graph is precise but opaque; without
  a visual surface, only ontologists can read it, so the very people who hold the operating
  knowledge cannot see the model that is supposed to describe their work.
- **Generic graph tools are static and solitary.** Existing ontology and diagramming tools
  render fixed pictures one person edits at a time; they do not let a whole organisation
  explore a large, living graph, drill into the part they care about, and work on it together.
- **No real-time collaboration on the operating model.** Modelling a company is inherently a
  group activity — ops, architecture, compliance, and leadership all hold pieces — but there
  is no Figma-style shared canvas where they co-explore and co-edit the same graph live.
- **The whole is invisible.** People understand their own silo but cannot see how domains,
  systems, processes, and data interconnect, so cross-cutting impact and dependencies stay
  hidden.

The people who feel this are **everyone who needs to understand the company** — operations
and business staff, architects, compliance, and leadership — none of whom can read raw RDF.
If this is not solved, the Constitution Engine's model stays locked behind expert tooling:
the graph exists, but the organisation cannot see itself in it, so adoption stalls and the
model is never collectively trusted or maintained.

## Vision

Within 12 months, success for the Graph Explorer looks like:

- **The whole company is visible at a glance.** A user opens the Explorer and sees their
  operating model as a navigable, force-directed network — domains, systems, processes, data,
  and people and how they interconnect — not a wall of RDF.
- **Anyone can drill in and focus.** From the whole-company view a user zooms into a single
  node, domain, or process and sees just its neighbourhood and relationships, then back out
  again, without losing their place.
- **People work on it together, live.** Multiple users explore and edit the same graph
  simultaneously, Figma-style, with presence and cursors, so a workshop or a distributed team
  can model the company together in real time.
- **Visual edits are safe edits.** Changes made on the canvas go through the Constitution
  Engine's validated operations (SHACL), so collaborative editing never produces an invalid or
  untrusted model.
- **Non-experts navigate confidently.** Business and operations staff explore and understand
  the model with no RDF or SPARQL knowledge, finding what they need through the visual surface.
- **Cross-cutting impact becomes obvious.** Users can see dependencies and impact across
  domains — what a system touches, what a process depends on — making hidden interconnections
  visible.
- **Versions are visible and navigable.** The Explorer presents the ontology, glossary, and
  graph as versioned artefacts with a visible change log — users can view a specific published
  version, see what changed between versions, and understand that projects and automations are
  pinned to a known version rather than a moving target. (The underlying draft → published
  versioning lifecycle and PROV-O provenance are owned by the Constitution Engine; the Explorer
  visualises them.)

## Scope

### In Scope

**Visualisation**

- A force-directed network view of the whole company graph — typed entities (the ontology's
  core types), their relationships, and governed content.
- Drill-in focus views: zoom into a node, domain, or process and its neighbourhood, with
  search, filtering, and navigation that keep the user oriented.
- Cross-cutting impact and dependency views — what a system touches, what a process depends on.
- Versioned views: select and view a specific published ontology version and see the change
  log / diff between versions (visualising the Constitution Engine's versioning).

**Real-time collaboration**

- Figma-style simultaneous multi-user exploration and editing, with presence, cursors, and
  selections.
- Built on a CRDT (Yjs) for concurrent canvas and presence state (exact sync transport
  finalised at tech spec).
- Authoritative graph writes always flow through the Constitution Engine's SHACL-validated
  operations — the CRDT manages the collaborative canvas/draft state, never an unvalidated
  commit to the trusted graph.

**Visual editing**

- Create and edit nodes and relationships directly on the canvas, with every committed change
  validated by the Constitution Engine — a no-RDF visual editing surface that complements
  Constitution's natural-language and forms authoring.

### Out of Scope

- **The model, store, ontology, SHACL validation, and OWL reasoning** — owned by the
  Constitution Engine. The Explorer reads the graph and writes through validated operations; it
  does not own the model or the validation logic.
- **The versioning lifecycle engine** (draft → published, version identifiers, PROV-O change
  logs) — owned by the Constitution Engine; the Explorer visualises versions and diffs.
- **Raw SPARQL query authoring** — provided by the Constitution Engine; the Explorer offers
  visual navigation and exploration rather than a query console.
- **The automation flow canvas** — that is the Events & Actions Engine's automation-specific
  canvas, not the company network view.
- **Project-level kanban / PM graph views** — those belong to the Build Engine.

## Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Operations / business staff | Need to understand the operating model and find their part of it | A visual, navigable view of the model with no RDF or SPARQL knowledge required |
| Enterprise architect | Navigates, edits, and assesses the structure of the model | Drill-in views, impact/dependency visibility, and visual editing that stays validated |
| Workshop facilitator / Weave consultant | Runs live collaborative modelling sessions with a client | Figma-style real-time multi-user editing so a room or distributed team can model together |
| Leadership / executive sponsor | Wants a high-level picture of how the company fits together | A whole-company view at a glance, with the ability to drill into areas of interest |
| Compliance / analyst | Reviews how things interconnect and how the model has changed | Dependency tracing and the ability to view specific versions and what changed between them |

## Success Criteria

- [ ] **The whole-company graph renders and navigates at real scale.** A real client graph
      renders as a force-directed network with usable drill-in, search, and filtering within
      acceptable interaction performance. Measured by a performance test against a realistic
      graph size; source: performance test results. Target: at GA.
- [ ] **Real-time collaboration works.** Multiple users (target: at least five concurrent)
      explore and edit the same graph simultaneously with presence and cursors, and their edits
      converge with no lost updates. Measured by a multi-user load and convergence test;
      source: QA. Target: at GA.
- [ ] **Visual edits are always validated.** 100% of changes committed from the canvas pass
      through the Constitution Engine's SHACL validation, and an invalid visual edit is
      demonstrably blocked. Measured by integration test; source: QA. Target: at GA.
- [ ] **Non-experts can navigate.** A business-role user with no RDF/SPARQL knowledge completes
      a find-and-understand task through the visual surface. Measured by a usability test with a
      defined success rate; source: usability study. Target: 30 days after GA.
- [ ] **Versioned views work.** A user can view a specific published ontology version and a
      diff between two versions. Measured by functional test; source: QA. Target: at GA.
- [ ] **It runs a real collaborative workshop.** At least one live multi-user modelling
      workshop is run with a client on the Explorer. Measured by a completed engagement; source:
      engagement record. Target: within 6 months of GA.

## Constraints

**Technical**

- The Explorer is a module within the single modular React SPA (Next.js 15, TypeScript
  strict) — not a separate app.
- Real-time collaboration uses a CRDT (Yjs); the sync transport (e.g. WebSocket on Fargate)
  is finalised at the tech spec and must scale to the target concurrent-user count.
- Force-directed rendering must remain performant at realistic graph sizes; the rendering
  approach (e.g. the Cytoscape.js reference prototype vs a WebGL renderer) is decided at the
  tech spec.
- Authoritative writes always go through the Constitution Engine's validated operations; the
  Explorer never writes unvalidated changes to the trusted graph.
- Collaboration sessions are scoped per tenant (multi-tenant isolation).

**Business**

- Real-time, Figma-style multi-user collaboration is required at launch and is
  non-negotiable; its engineering complexity is accepted.

**Timeline / sequencing**

- The Explorer depends on the Constitution Engine (it reads and writes that graph) and is part
  of making the MVP usable — the formal model is not consumable by non-experts without it, so
  it is needed early rather than late.

## Key Decisions

For the platform-wide master list see `CLAUDE.md § Architecture decisions (confirmed)` and
the `weave-platform` brief. Decisions specific to the Graph Explorer:

| Decision | Rationale | Date |
|----------|-----------|------|
| Graph Explorer owns the visual canvas and collaboration UX; the Constitution Engine owns the model, store, and validation | Clean separation: how the graph is seen and collaboratively manipulated vs what the graph is and what is valid | 2026-06-26 |
| Real-time collaboration uses a CRDT (Yjs) | Mature, open, portable, self-hostable on AWS; no per-seat SaaS lock-in; manages concurrent canvas/presence state | 2026-06-26 |
| Authoritative writes always flow through Constitution's SHACL validation | Collaborative editing must never produce an invalid or untrusted model; the CRDT manages canvas/draft state only | 2026-06-26 |
| Figma-style real-time multi-user collaboration is required at launch | A core differentiator and what makes group modelling possible; non-negotiable | 2026-06-24 |
| The Explorer is a module within the single React SPA | Consistent with the platform's single-modular-SPA decision (no micro-frontends) | 2026-06-24 |
| The Explorer visualises versioned ontology/glossary/graph and diffs | Lets users view specific published versions and changes; the versioning lifecycle itself is owned by the Constitution Engine | 2026-06-26 |
| Needed early as part of MVP usability | The formal Constitution model is not consumable by non-experts without a visual surface | 2026-06-26 |
| Rendering approach (Cytoscape.js vs WebGL renderer) deferred to tech spec | A performance/scale decision better made with concrete graph-size targets | 2026-06-26 |

## Navigation

First-draft **secondary navigation** (left sidebar) for the **Explorer** primary area. The
primary top-header nav is defined in the `weave-platform` brief. The Explorer is
canvas-centric, so the sidebar is a set of panels over a persistent graph canvas rather than
separate screens.

- **Explore (canvas)** — the default force-directed view of the company graph.
- **Saved views** — saved and shared focus/drill-in views (e.g. a domain, a process).
- **Filters & layers** — toggle entity types and relationship layers; search and filter.
- **Versions & diff** — view a specific published version and compare versions (visualising the
  Constitution Engine's versioning).
- **Collaboration** — active sessions, presence, and participants (workshop mode).

> The canvas itself stays visible; selecting a sidebar panel changes what is overlaid or
> filtered, not the whole screen. Authoritative edits made on the canvas route through the
> Constitution Engine's validation.

---
*Generated by Weave PO agent. Review and approve before proceeding to PRD.*
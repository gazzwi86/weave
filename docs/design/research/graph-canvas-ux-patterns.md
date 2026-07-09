---
type: Design
title: "Research — graph exploration & canvas UX patterns"
description: "WS2 competitor/pattern research: Neo4j Bloom & Browser, Linkurious/Ogma, Foundry
  Object Explorer, Kumu, Obsidian, yFiles, Miro/FigJam — with the top-10 transferable patterns for
  Weave Explorer and /ce/query."
tags: [design, research, explorer, query]
status: "Complete — WS2 input (sonnet research agent, 2026-07-09)"
timestamp: 2026-07-09T00:00:00Z
resource: docs/design/research/graph-canvas-ux-patterns.md
source: sonnet research agent (web), WS2 design assessment
owner: gazzwi86
---

# Graph exploration & canvas UX research

## Neo4j Bloom

- Search-driven entry, not menu-driven: users type near-natural-language search phrases (custom
  Cypher templates under the hood) rather than browsing a schema tree first.
- "Perspectives" scope the whole UI to a business role (e.g. shipping only sees
  orders/products/customers) — same graph, different vocabulary and visible categories per
  audience.
- Expansion is incremental and node-anchored: right-click a node (or use the Inspector) to pull in
  its neighbors, expand along one relationship type/direction, or open an "Advanced Expansion"
  dialog for multi-hop patterns. A per-expansion node cap overrides the global limit so one click
  can't flood the canvas.
- Double-click opens the Inspector (side panel) with full properties and doubles as a launch point
  for further expansion — inspector and expansion are the same affordance, not two separate modes.
- Filter drawer builds itself from what's actually in the current scene (categories/types/
  properties present), not the whole schema; filtered-out elements grey out (stay visible,
  non-interactive) rather than vanishing, with a separate "dismiss" action to actually remove them.
- Canvas chrome is consistently corner-docked: zoom, layout switcher, minimap all bottom-right;
  legend panel bottom-left-ish and collapsible (hidden in presentation mode, one arrow-click to
  recover). Filters and legend never float over the graph itself.
- Write-mode lets you edit labels/properties and create nodes/relationships directly on canvas,
  gated behind an explicit write-transaction permission — editing is opt-in, not a persistent risk.

Sources: Bloom scene interactions, Perspective creation, Legend panel, Edit graph data
(neo4j.com/docs/bloom-user-guide).

## Neo4j Browser / Aura Query

- The canonical pattern: every query result is one reusable "frame" with a view switcher (icons)
  offering Graph / Table / Raw(JSON) / Plan — same result set, four lenses, one click to flip.
- Frames are editable in place: tweak the query inside its own result frame and re-run to update
  that frame, or Cmd/Ctrl-click a frame to send its query back to the main editor.
- Known rough edge worth avoiding: graph view silently applies a node-count visualization cap
  distinct from the query's actual result size, and a query returning only relationships (no bound
  nodes) can't render as a graph at all — both cause "my results don't match" confusion.
- Zoom/fit-to-screen controls sit bottom-right of the graph frame specifically, not globally —
  chrome is scoped per-result, not per-page.

Sources: Result frames, Visual tour (neo4j.com/docs/browser); community thread on graph/table view
inconsistency (community.neo4j.com/t/23988).

## Linkurious / Ogma

- A rendering + rules engine, not a prescriptive app shell — inspector/toolbar/legend are patterns
  composed from primitives (`ogma.rules`, DOM/CSS overlays), not a fixed UI. The transferable idea
  is the primitive set: visual grouping/clustering, swim-lane layouts, annotation overlay layer,
  and pivot-between-representations as first-class rendering modes alongside node-link.
- Ships a published, reusable style-theme package (incl. colorblind-safe palettes) so
  legends/toolbars stay visually consistent across graph views — theming is a shared token layer.

Sources: doc.linkurious.com/ogma; github.com/Linkurious/ogma-styles.

## Palantir Foundry Object Explorer

- Home screen is search-first: one global search box across the whole ontology with type-ahead
  inline results, backed by browsable object-type cards grouped into admin-curated groups (role
  scoping expressed as navigation groups instead of a full UI retheme).
- Clicking an object-type card opens a lightweight preview inspector (description, properties,
  linked types) inline, without leaving the home screen — full drill-in ("Start Exploration") is a
  separate, deliberate step. Two-tier preview → commit avoids a context switch for a casual glance.
- A dedicated "group graph view" shows link types between object types at the schema level — for
  understanding the shape of a corner of the ontology before exploring instances.
- Foundry does NOT use a breadcrumb/focus-history trail — persistence is "saved explorations" as
  named artifacts instead of session history. A deliberate alternative, not an oversight.

Sources: palantir.com/docs/foundry/object-explorer (overview, getting-started).

## Kumu.io

- Four distinct narrowing verbs, each with different semantics: Filter (hide), Focus (isolate a
  neighborhood), Showcase (fade non-matches translucent — keeps spatial/mental context), Cluster
  (group). Hide vs dim vs isolate are genuinely different user intents.
- Chrome placement is configurable data (an `@controls` block) assigning search/toolbar/zoom/legend
  each to one of six canvas regions — chrome-as-config rather than chrome-as-fixed-layout.
- "Views" bundle filter/focus/cluster state as a named, savable, switchable configuration.

Sources: docs.kumu.io (filter, controls, legends guides).

## Obsidian graph view (cautionary)

- Community threads consistently flag: filter/color-group configs can't be saved as reusable
  presets (users rebuild the same filter every session), local-graph settings don't persist like
  global settings, color grouping stops scaling past a handful of groups.
- Takeaway: view state (filters, focus, layout) needs first-class save/name/switch semantics from
  day one.

Sources: help.obsidian.md/plugins/graph; forum.obsidian.md/t/22594.

## yFiles demos

- Side panel serves two jobs simultaneously: element inspection (properties, edit) AND algorithm
  configuration (layout parameters) — same real estate, context-dependent content.
- Popovers as the lighter alternative for quick glances; the committed side panel for deep
  inspection.
- An "overview" minimap (drag a rectangle to move the viewport) is a standard companion, not a
  one-off.

Sources: yfiles.com/demos.

## Miro / FigJam (canvas chrome)

- FigJam's minimal bottom toolbar with large literal icons + progressive disclosure is consistently
  cited as the readability winner over Miro's denser interface.
- Floating contextual toolbars are the single most-complained-about pattern in Miro's and Figma's
  (UI3) communities — they occlude the content being worked on. Any floating toolbar over a canvas
  should be pinnable/dockable.

Sources: startup-house.com figjam-vs-miro; Miro community idea 15695; Figma forum UI3 threads.

## Top 10 transferable patterns for Weave Explorer + /ce/query (ranked by impact)

1. **Graph/Table/Raw view toggle on every query result** (Neo4j Browser) — /ce/query renders
   results as one-click-switchable Graph / Table / Raw-JSON, not separate screens. Highest-leverage
   borrow.
2. **Corner-docked, non-floating canvas chrome** (Bloom + yFiles; Miro/Figma backlash as negative
   case) — zoom/layout/minimap bottom-right, legend bottom-left, never floating over the graph.
3. **Filter built from what's on screen, not the whole schema** (Bloom) — populate from
   kinds/relationships present in the current view; grey out non-matches rather than vanish.
4. **Four narrowing verbs instead of one "filter"** (Kumu: filter/focus/showcase/cluster).
5. **Named, savable views as first-class objects** (Bloom Perspectives, Foundry saved explorations,
   Kumu Views; Obsidian pain as the negative case). Maps to CE-V1-TASK-026 (Saved Views).
6. **Search-first entry, not schema-browse-first** (Bloom, Foundry global search w/ type-ahead).
7. **Two-tier preview vs commit for drill-in** (Foundry inline preview card vs "Start
   Exploration").
8. **Inspector doubles as the expansion launch point** (Bloom double-click → Inspector → expand).
9. **Role/perspective-scoped views of the same graph** (Bloom Perspectives, Foundry type groups).
10. **Per-expansion node cap, separate from the global limit** (Bloom) — guardrail against the
    instant-hairball failure mode.

Explicit gap flagged: none of the seven products use a breadcrumb/focus-history trail for graph
drill-down (Foundry deliberately substitutes saved artifacts). A "path I took" trail would be a
genuine design decision with no reference implementation to copy.

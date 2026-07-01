---
type: Coding Standard
title: Data Visualisation — Coding Standard
description: "The visual aesthetic for Weave's data surfaces: the BPMO living graph (node/edge styling using the 14 kind colours + shapes, spotlight/trace/heatmap/diff overlays, force vs C4 modes on Cytoscape.js + the embeddable GE-CANVAS-1), chart styling for the generative-UI catalogue (KPI/line/bar/heatmap/pie) including a defined categorical series palette and a sequential heat ramp, and the accessible-data-viz rules (never colour-alone: shapes, glyphs, dash patterns, direct labels, legends)."
tags: [standards, design, data-viz, graph, cytoscape, charts, accessibility]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/data-viz.md
---

# Data Visualisation

Weave is a graph product, so data visualisation is a first-class surface, not a decoration. This file
owns the **visual aesthetic** of two things: the **BPMO living graph** (the force/C4 canvas) and the
**charts** in the generative-UI catalogue. It is dark-first and graph-native — glowing nodes on deep
navy, the W-mark motif made literal.

Every value is a `var(--token)`, never a literal — colour from [`color.md`](color.md), the rest from
[`tokens.md`](tokens.md). Two new token families are defined here (a categorical **series** palette
and a sequential **heat** ramp) and flagged for `tokens.json`, because neither exists yet and the raw
prototype hexes must not be inlined.

## The living graph — canvas aesthetic

The graph canvas is the signature surface and a glass/glow surface (one of the reserved few in
[`tokens.md`](tokens.md)). It renders on **Cytoscape.js** (`^3.30.0`) with `cytoscape-fcose` — ground
all styling in what Cytoscape actually does, not DOM metaphors.

### Nodes

- **Kind colour + shape + glyph.** Each node is filled with its `--color-kind-*` (dark variant) and
  drawn in the kind's `--shape-kind-*` silhouette with its interior glyph — the pairing
  [`color.md`](color.md) defines (resolving OQ-08). Shapes/glyphs are **referenced, not redefined
  here**; this file only states how they render on canvas. `Process` keeps its prominent red filled
  hexagon (first-class kind). Unknown/extension kinds use the `--color-kind-fallback` dotted-circle.
- **Glow is a canvas property, not DOM `box-shadow`.** Use Cytoscape's `shadow-blur` / `shadow-color`
  / `shadow-opacity` node style (or a halo/overlay layer), tinted from the node's kind colour or the
  brand accent. The active-node halo uses the cyan brand stop (`--glow-brand` semantics →
  `shadow-color` cyan). Default nodes carry a subtle glow; the glow intensifies on
  selection/spotlight. Reduced-motion does not animate glow pulsing (`pulseGlow` keyframe is gated).
- **Labels** follow semantic-zoom thresholds (PRD E1-S2): node labels show above default `0.3×`, edge
  labels above default `0.55×` (both tunable per workspace). Label text uses `--color-text-default`;
  IDs/counts use `--font-mono` ([`typography.md`](typography.md)).
- **Selected** node: `--color-accent-primary` (cyan) ring + intensified halo. See the spotlight-colour
  reconciliation below.

### Edges

- **Default low-contrast, brighten on focus.** Resting edges use `--color-border` / `--color-border-soft`
  so the graph reads calm; edges in a spotlight neighbourhood or trace brighten to
  `--color-text-muted` / the overlay accent. This is the brand's "edges recede, the structure you
  touch lights up" behaviour.
- Relationship-type → stroke styling (e.g. dashed for membership vs solid for dependency) is the
  net-new mapping flagged in the PRD; where used it must **also** carry a legend entry (never stroke
  alone for a colour-blind-equivalent reason — pattern + legend).

### The signature moment

The `livingGraph` keyframe ([`tokens.md`](tokens.md)) animates the canvas into life on first load
(fcose `animate:true, animationDuration:600ms` per Explorer E1-S1) — the brand "alive" moment. It is
GPU-friendly (transform/opacity) and has a `prefers-reduced-motion` static-layout fallback: the graph
appears already settled, no entrance animation.

## Overlays — spotlight, trace, heatmap, diff

These are the Explorer's visual overlays (PRD Epics 1, 2, 4). Each must satisfy SC 1.4.1 — colour is
never the sole carrier.

### Spotlight (E1-S3) — colour reconciliation

On node click, the `closedNeighborhood` holds full opacity and everything else dims to default `0.18`
opacity (tunable). The PRD calls the highlight "spotlight blue" — that is **prototype legacy**. In
this design system the spotlight/selected accent is the **brand cyan** (`--color-accent-primary`) with
`--glow-brand`, not a one-off blue. Naming this so the implementation uses the brand accent, not a
literal blue. Dimming uses opacity (GPU-friendly); reduced-motion applies it without transition.

### Impact / dependency trace (E2-S3, E4-S3)

The trace highlight is a **distinct amber overlay**, deliberately separate from the cyan spotlight, so
"this is the impact chain" never reads as "this is selected." Amber maps to `--color-warn`. A pinned
impact view persists through pan/zoom and is clearable. Off-canvas dependencies surface a counted
badge — the trace never silently truncates. Because amber-vs-cyan is a colour distinction, the trace
also carries a visible "Impact trace" overlay label/legend so the two overlays are distinguishable
without colour.

### Heatmap overlay (E4-S1) — the sequential heat ramp (new tokens)

The heatmap recolours Capability nodes by a chosen dimension (maturity / investment / strategy /
lifecycle). The prototype inlines raw hexes; this system defines a **named sequential ramp**, distinct
from both the categorical kind palette and the brand gradient, flagged for `tokens.json`:

| Token | Role | Light-end → dark-end intent |
|---|---|---|
| `--color-heat-1` | lowest / weakest (maturity 1, "None", "End of Life") | hottest red, `--color-danger` family |
| `--color-heat-2` | low | orange |
| `--color-heat-3` | mid | amber, `--color-warn` family |
| `--color-heat-4` | high | lime/green-ward |
| `--color-heat-5` | highest / strongest (maturity 5, "Active") | `--color-success` family |
| `--color-heat-none` | unmatched / free-text outside vocabulary | neutral grey (`--color-kind-fallback` family) |

Rules: the ramp is **ordered** (it encodes magnitude, so it is intentionally a sequential gradient,
unlike the categorical kinds). Unmatched free-text values map to `--color-heat-none` and are **counted
in a legend note** ("N unrecognised values"), never dropped. A legend (bottom corner) always maps
colour → value — this is the non-colour-alone carrier for the heatmap. The ramp's exact OKLCH stops
and computed contrast are specified alongside the other colour tokens when promoted to `color.md` /
`tokens.json`; until then this table is the contract.

### Diff overlay (E4-S2) — colour **and** glyph (closes a 1.4.1 gap)

The diff overlay borders elements by change type. Border colour alone fails SC 1.4.1, so **each change
type pairs a border colour with a glyph badge**:

| Change | Border colour | Required glyph | Notes |
|---|---|---|---|
| added | `--color-success` | `+` | green border |
| removed | `--color-danger` at default `0.35` opacity | `−` | dimmed, still legible |
| modified | `--color-warn` | `~` | amber; nodes **and** edges (edge mods in scope, D3) |

Clicking a modified element opens a before/after property diff (side panel; `CE-DIFF-1`
`modified[].before/after`); a summary panel lists added/removed/modified counts. Identical versions →
"no differences"; an error → retryable banner. The glyph + the summary panel are the non-colour
carriers.

## Force vs C4 modes (GE-CANVAS-1)

The Explorer owns the embeddable **`GE-CANVAS-1`** component with two modes:

- **`force`** — organic fcose layout (PRD params: `nodeSeparation:90, idealEdgeLength:110,
  nodeRepulsion:6500, randomize:true`), the whole-company "alive" view. Clusters emerge; this is the
  default and the signature aesthetic.
- **`c4`** — structured/hierarchical layout for architecture views (the Explorer absorbs the
  prototype's second C4/"Model" canvas). Layered, deliberate, less organic; same kind colours + shapes
  + glyphs so a node reads identically across modes, but positioned by structure not physics.

A **mini-map** (fixed bottom-right, `--z-canvas-overlay`) shows viewport position; the **legend**
(also a canvas overlay) maps shape + glyph + colour → kind name and is the persistent non-colour
fallback at extreme zoom-out where a glyph goes sub-pixel.

## Chart styling (generative-UI catalogue)

Charts are the catalogue widgets `LineChart`/`AreaChart`, `BarChart`, `PieChart`/`DonutChart`,
`Heatmap`, `KpiCard` ([`generative-ui.md`](../generative-ui.md) owns the catalogue; this file styles
the interiors). All flat (chart tiles are flat cards — see [`components.md`](components.md)).

### The series palette (new tokens) — resolving the gap without contradicting color.md

`color.md` explicitly forbids the brand gradient on data-viz series and says "kinds own the data-viz
palette." But a bar/line chart plotting **non-kind** categories (e.g. monthly counts, arbitrary
groups) has no defined colours. Resolution, consistent with `color.md`:

- **Kind-valued series** (a series whose categories *are* BPMO kinds) use the `--color-kind-*` tokens
  + the kind glyph in the legend. No new colours.
- **Generic categorical series** use a small, ordered, **discrete** series palette —
  `--color-series-1 … --color-series-6` — drawn from the brand family but **enumerated as fixed
  swatches, explicitly not the continuous brand gradient** (the gradient stays a brand moment). Six
  perceptually-spaced stops; cycle with a legend if a chart exceeds six. Flagged for `tokens.json`.
- The **heat ramp** above is reused for any sequential/magnitude encoding in a `Heatmap` widget.

### Per-chart treatment

| Widget | Treatment |
|---|---|
| `KpiCard` | value in `--font-mono` `--text-h2`, tabular figures; delta in `--color-success`/`--color-danger` **with ▲/▼ glyph** (not colour-alone); sparkline uses one `--color-series-1` |
| `LineChart` / `AreaChart` | line `--color-series-*`; area fill at low alpha of the same; gridlines `--color-border-soft`; **multi-series gets distinct dash patterns** (solid/dashed/dotted) so lines differ without colour; axes `--color-text-muted` |
| `BarChart` | bars `--color-series-*` (or `--color-kind-*` if kind-valued); `--radius-sm` bar corners; direct value labels where space allows |
| `PieChart` / `DonutChart` | slices `--color-series-*`; **direct labels / leader lines**, not a colour-only legend; donut centre may hold a `--font-mono` total |
| `Heatmap` (chart) | the sequential `--color-heat-*` ramp; cell values shown on hover/focus; a colour-scale legend |
| chart text | titles `--text-h4`, axis/labels `--text-body-sm`/`--text-label`, numbers `--font-mono` tabular |

## Accessible data-viz rules

The colour-blind-safe, screen-reader-aware contract for every surface above. WCAG thresholds and the
axe gate live in [`accessibility.md`](../accessibility.md); this file states the *visual* obligations.

- **Never colour-alone (SC 1.4.1) anywhere:** graph nodes = shape + glyph + label (`color.md`); diff =
  colour + `+`/`−`/`~` glyph; KPI delta = colour + ▲/▼; multi-line series = colour + dash pattern; pie =
  direct labels; heatmap + legend; trace vs spotlight = labelled overlays. Every overlay ships a
  **legend**.
- **Direct labelling over legend lookup** where space allows (reduces the colour-matching burden).
- **Canvas keyboard equivalents** — the force canvas is the one surface exempt from full
  screen-reader navigability in v1, but it must not trap focus and must provide a keyboard equivalent
  for every pointer interaction (zoom `+`/`-`, `Cmd/Ctrl+0` fit, arrow-pan, Tab-to-node + `Enter` to
  spotlight). **Cross-ref the [`accessibility.md`](../accessibility.md) canvas table — not restated here.**
- **Contrast** of every node/series/heat token meets its floor on navy (computed in `color.md` for
  kinds; the new series/heat tokens record theirs when promoted). Edges are decorative and may sit
  below the text floor by design (`color.md`).
- **Reduced motion:** the `livingGraph` entrance, glow `pulseGlow`, and any layout transition have
  static fallbacks; the graph still loads, just settled (`tokens.md` / `accessibility.md`).
- **No data source / unavailable / stale** states for chart widgets are the defined terminal states
  from [`generative-ui.md`](../generative-ui.md), styled in [`components.md`](components.md) — never a
  blank or hallucinated chart.

## Definition of done (data-viz surface)

- [ ] Every colour/type/space value is a `var(--token)`; the new `--color-series-*` and
      `--color-heat-*` are defined and flagged for `tokens.json` (no inlined prototype hexes).
- [ ] Graph nodes render kind colour **+ shape + glyph** (`color.md`); selected = brand cyan +
      `--glow-brand`, not literal blue.
- [ ] Every overlay (spotlight, trace, heatmap, diff) carries a legend / glyph so meaning survives
      greyscale (SC 1.4.1): diff = `+`/`−`/`~`, KPI delta = ▲/▼, multi-series = dash patterns.
- [ ] Node glow uses Cytoscape canvas styling (`shadow-*`/halo), not DOM `box-shadow`.
- [ ] Heatmap unmatched values → `--color-heat-none` + counted in the legend, never dropped.
- [ ] `force` and `c4` modes render a node identically (same colour/shape/glyph), differing only in
      layout; mini-map + legend present.
- [ ] Canvas provides keyboard equivalents and does not trap focus (`accessibility.md`); all motion
      has a `prefers-reduced-motion` fallback.
- [ ] `@axe-core/playwright` zero violations on the non-canvas chrome; canvas asserted for focus-trap +
      container no-violation (`accessibility.md`).

## Cross-references (do not duplicate)

- [`color.md`](color.md) — the 14 kind colours, their `--shape-kind-*` glyphs (OQ-08), the brand
  gradient, status colours, and the "kinds own the data-viz palette / gradient is a brand moment" rule
  this file honours.
- [`tokens.md`](tokens.md) — `--shadow-*`, `--glow-brand`, `--z-canvas-overlay`, `--duration-*`,
  motion keyframes (`livingGraph`, `pulseGlow`); the home for the new `--color-series-*` /
  `--color-heat-*` once promoted.
- [`generative-ui.md`](../generative-ui.md) — **owner** of the chart/widget catalogue, intent mapping,
  streaming, and the data-source/unavailable/stale terminal states.
- [`components.md`](components.md) — the chart tile (flat card), the side-panel/inspector that shows
  diff/spotlight detail, and the visual treatment of widget states.
- [`accessibility.md`](../accessibility.md) — the canvas keyboard-equivalents table, contrast floors,
  legend requirement, reduced-motion, axe gate. **WCAG numbers and the canvas table are not restated.**
- Graph Explorer PRD (`docs/specs/graph-explorer/02-prd/prd.md`) — the source of fcose params,
  spotlight/trace/heatmap/diff behaviours, semantic-zoom thresholds, and `GE-CANVAS-1` modes.

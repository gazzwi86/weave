---
type: Coding Standard
title: Layout & Grid — Coding Standard
description: "The 8pt spacing rhythm applied, the responsive breakpoint behaviour, the Weave app-shell composition (topnav / sub-nav / content / docked inspector), the bento dashboard grid, container/content max-widths, and the density-mode layer — all driven from the space and breakpoint tokens in tokens.md."
tags: [standards, design, layout, grid, responsive, frontend]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/layout-grid.md
---

# Layout & Grid

Weave's layout is **calm, dense, and graph-native**: a persistent app shell wrapping a large
canvas, whitespace on an 8pt rhythm, a docked inspector that slides in, and a bento grid for the
generative dashboard. The structure stays still while content moves (see
[`motion.md`](motion.md)) — navigation feels instant because only the content region transitions.

This file owns **composition and responsive behaviour**, not scalar values. The spacing ramp
(`--space-*`), the breakpoints (`--bp-*`), corner radii, and z-index layers are canonical in
[`tokens.md`](tokens.md) (§space, §breakpoint, §radius, §zIndex) and are referenced by name here,
never re-tabled. The accessibility floors for reflow (320px), zoom (200%), and target size
(≥24px) live in [`accessibility.md`](../accessibility.md) and are cross-referenced, not restated.

## Spacing system — the 8pt rhythm applied

The grid is built on a `4px` base unit with an `8px` rhythm (`--space-1` … `--space-12` in
`tokens.md`). The rule: **every margin, padding, and gap is a `--space-*` token** — no literal px.
The mapping of token to layout role:

| Role | Token |
|---|---|
| Icon ↔ label gap, chip inner gap | `--space-1` (4px) |
| Tight vertical stack, input padding-y | `--space-2` (8px) |
| Button padding-y, card inner element gap | `--space-3` (12px) |
| Card padding, default stack gap, list-row padding | `--space-4` (16px) |
| Panel padding, gap between cards, section gap | `--space-5` (24px) |
| Block gap, dashboard tile gap | `--space-6` (32px) |
| Major section gap | `--space-8` (48px) |
| Page-shell padding, hero spacing | `--space-10` (64px) |

Whitespace philosophy: **calm over crammed.** Best-in-class dashboards show 5–9 core elements with
generous whitespace and progressive disclosure (reveal-on-demand), not a wall of widgets. Prefer
one more unit of breathing room over one more pixel of density. Group related controls tightly
(`--space-2`/`--space-3`) and separate distinct regions generously (`--space-5`/`--space-6`) so
hierarchy reads from spacing alone.

## Breakpoints & responsive behaviour

Mobile-first. The SPA reflows usable down to 320 CSS px (the WCAG 1.4.10 floor —
[`accessibility.md`](../accessibility.md) owns the number) with no horizontal scroll, and survives
200% zoom without loss of function. Breakpoint values are canonical in `tokens.md` §breakpoint;
this is the **behaviour at each step**:

| Breakpoint (tokens.md) | Layout behaviour |
|---|---|
| base (< `--bp-sm`, ≥ 320px) | Single column. Topnav condenses to brand + overflow menu; sub-nav becomes a dropdown/segmented control; inspector becomes a full-screen sheet. Bento → 1 column. |
| `--bp-sm` (640) | Large-phone tuning; bento stays 1 column; comfortable density only. |
| `--bp-md` (768) | **Sub-nav collapses** to a compact form; bento → 2 columns; inspector is an overlay sheet (not docked). |
| `--bp-lg` (1024) | **Side panel / inspector docks** beside the content instead of overlaying; bento → 3 columns; compact density becomes available. |
| `--bp-xl` (1280) | **Full graph canvas + docked inspector** side by side; bento → 4 columns; comfortable max content width applies. |
| `--bp-2xl` (1536) | Wide bento dashboards; content capped at the max container width (below) — extra space becomes margin, not stretched content. |

The docked-vs-overlay inspector and the sub-nav collapse are the two load-bearing transitions;
drive them off the `--bp-*` tokens and the `--z-*` layers (the overlay inspector sits at
`--z-panel`, the docked inspector is in normal flow).

## App-shell composition

The shell is three persistent regions plus an on-demand inspector. It is the real prototype
structure — Blushift's `grid-template-rows: 44px auto 1fr` (topnav / sub-nav / body) and the
prototype's `topbar` + `role="tablist"` sub-nav + `<main>` + 520px slide-in `detail-panel`.

```text
┌──────────────────────────────────────────────────────────┐
│ TOPNAV   brand · project switcher · search(⌘K) · user     │  --z-sticky, sticky, ~56px
├──────────────────────────────────────────────────────────┤
│ SUB-NAV  Query · Graph · Domain · … (role=tablist)        │  --z-sticky, ~44px, collapses < md
├───────────────────────────────────────┬──────────────────┤
│                                        │                  │
│  CONTENT  <main>                       │  INSPECTOR       │
│  (graph canvas / bento dashboard /     │  docked ≥ lg,    │
│   table view)  — the only region       │  overlay < lg    │
│   that animates on route change        │  (slideInPanel,  │
│                                        │   --z-panel)     │
└───────────────────────────────────────┴──────────────────┘
```

Rules:

- **Topnav** is sticky (`--z-sticky`), holds brand + project switcher + the **Cmd-K command
  palette** entry (a first-class surface; the palette overlay itself sits at `--z-command`, above
  modals — see `tokens.md` §zIndex) + user menu. ~56px tall; padding from `--space-4`/`--space-5`.
- **Sub-nav** is the `role="tablist"` view switcher (`aria-selected` on the active tab — the
  prototype `App.tsx` pattern, see `accessibility.md`). Sticky beneath the topnav; the active
  indicator slides on switch (`motion.md`). Collapses at `--bp-md`.
- **Content `<main>`** is the single region that transitions on route change (`motion.md`); the
  shell chrome never re-animates. One `<main>` landmark per view (`accessibility.md`).
- **Inspector / side panel** is the detail surface. Docks in-flow at `--bp-lg`+; below that it is
  an overlay that enters with `slideInPanel` and carries the static `--shadow-panel` (cross-ref
  `tokens.md` §shadow, `motion.md`). Width ~`--space`-derived fixed column (prototype: 520px on
  desktop); full-width sheet on mobile. It traps + restores focus and closes on Escape
  (`accessibility.md`).
- The **graph canvas** is a focusable region (`tabIndex={0}`, `role` + `aria-label`) that must not
  trap Tab and provides keyboard pan/zoom equivalents (`accessibility.md`). Canvas-overlay chrome
  (mini-map, legend, toolbar) sits at `--z-canvas-overlay`.

## Bento dashboard grid

The Platform Generative Dashboard composes catalogue widgets (`generative-ui.md`) into a **bento
grid** — a dense-but-ordered set of tiles of varied span, not a uniform matrix.

- CSS Grid, 12-column track at `--bp-xl`+, collapsing per the breakpoint table (4 → 3 → 2 → 1
  effective columns as width drops). Gap is `--space-6` (tiles) with `--space-4` internal padding.
- Each catalogue widget declares a **column span** (carried on the resolved widget definition —
  `generative-ui.md`): a `KpiCard` spans 3, a `LineChart`/`DataTable` spans 6–12, an `AlertBanner`
  spans full width. Spans clamp down at each breakpoint (a 6-span tile becomes full-width on
  mobile).
- Tiles align to the grid; row height is content-driven with a minimum so a sparse dashboard
  stays calm rather than collapsing to a thin strip. Skeleton tiles occupy their final span during
  streaming (`shimmer`, `motion.md`) so the layout does not reflow when data lands.

## Container & content widths

Content does not stretch edge-to-edge on wide displays — beyond the max, extra space becomes
margin.

| Container | Max width | Use |
|---|---|---|
| Full-bleed | none | graph canvas, the bento dashboard grid (uses the full content region) |
| Wide | ~1440px | dense table/list views, multi-column dashboards |
| Reading | ~768px | prose, settings forms, spec/detail text, single-column flows |
| Inspector column | fixed (~520px desktop / full-width mobile sheet) | the docked/overlay detail panel |

Centre capped containers in the content region; gutter with `--space-5`/`--space-6`. The graph
canvas and bento grid are intentionally full-bleed — they *are* the content, and capping them
would waste the surface that makes Weave feel graph-native.

## Density modes

Two densities, selected by a `[data-density]` attribute on the shell root — parallel to the
`[data-theme]` hook in `tokens.md`, and following the same one-source rule: density **remaps the
`--space-*` aliases**, it does **not** introduce a second spacing token set (Law #2 — minimum
mechanism).

Three layout-facing aliases derive from the raw `--space-*` scale; comfortable is their default,
compact tightens each by one rung. The aliases are the only new names — they resolve to existing
`--space-*` tokens, never to literal px.

```css
:root {
  /* comfortable — the default density */
  --space-row:     var(--space-3);   /* list/table row padding-y: 12px */
  --space-card:    var(--space-4);   /* card padding: 16px */
  --space-section: var(--space-5);   /* section gap: 24px */
}

[data-density="compact"] {
  /* tighten the layout-facing aliases by one rung; the raw scale is unchanged */
  --space-row:     var(--space-2);   /* 12px → 8px */
  --space-card:    var(--space-3);   /* 16px → 12px */
  --space-section: var(--space-4);   /* 24px → 16px */
}
```

- **Comfortable** (default) — the canonical `--space-*` values; generous, calm; the marketing and
  first-run experience.
- **Compact** — for power users on dense data (tables, the task-tree, large graphs) who want more
  on screen; tightens row/card/section padding by one rung via the aliases above. Compact only
  becomes available at `--bp-lg`+ (it would break target sizes on small screens).
- Interactive target sizes must hold in **both** densities — compact tightens *padding/gaps*, never
  the ≥24px hit area (`accessibility.md` owns the number). A compact row may be visually tighter
  but its control hit-targets stay ≥ the floor.

## Definition of done (layout / responsive surface)

- [ ] Every margin/padding/gap is a `--space-*` token; no literal px in layout code.
- [ ] Responsive behaviour is driven by `--bp-*` tokens; sub-nav collapses at `--bp-md`, inspector
      docks at `--bp-lg`, full graph+inspector at `--bp-xl`.
- [ ] Usable at 320px with no horizontal scroll and at 200% zoom (cross-ref `accessibility.md`).
- [ ] One `<main>` landmark; topnav/sub-nav use the correct landmarks and `role="tablist"`
      pattern; z-layers from `tokens.md` §zIndex.
- [ ] Inspector docks ≥ `--bp-lg`, overlays below, traps + restores focus, closes on Escape.
- [ ] Bento tiles declare a span that clamps per breakpoint; skeletons hold final span during
      streaming.
- [ ] Density is a `[data-density]` alias remap, not a second token set; target sizes hold in both
      densities.

## Cross-references (do not duplicate)

- [`tokens.md`](tokens.md) — canonical `--space-*`, `--bp-*`, `--radius-*`, `--z-*` values and the
  `[data-theme]`/`[data-density]` attribute model. This file does not restate the values.
- [`accessibility.md`](../accessibility.md) — reflow (320px), zoom (200%), target size (≥24px),
  landmarks, the canvas keyboard contract, focus trap/restore. This file does not restate WCAG
  numbers.
- [`motion.md`](motion.md) — the content-region route transition and the `slideInPanel` inspector
  entrance; the shell chrome that stays still.
- [`generative-ui.md`](../generative-ui.md) — the catalogue widgets and their column-span
  definitions that populate the bento grid.

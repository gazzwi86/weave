---
type: Coding Standard
title: Design — Coding Standard
description: "The Weave design north-star: the dark-first, vibrant-gradient, graph-native direction and design principles, structured as the x.ai/Google-Stitch 9-section DESIGN.md that AI agents consume. Indexes the child standards (colour, typography, tokens, iconography, voice & imagery), and states that this human-authored parent compiles — with resolved token values — to the distributed DESIGN.md and to the CE-BRAND-1 design-token JSON."
tags: [standards, design, brand, north-star, design-system, frontend]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/design.md
---

# Design

This is the **north-star** of the Weave design system and the parent of every child standard. It
is authored in the **x.ai / Google-Stitch 9-section `DESIGN.md` format** so that it *is* the
agent-consumable design document — compiled, with resolved token values from
[`tokens.md`](tokens.md), into the distributed `DESIGN.md` that coding agents read, and into the
`CE-BRAND-1` design-token JSON the Build Engine consumes.

> **Authored vs generated (read this).** Per [`tokens.md`](tokens.md), the children are the
> *human-authored source*; `DESIGN.md` and `tokens.json` are *generated artefacts*. This file is
> the **human-authored parent** structured in the 9-section format; the **distributed `DESIGN.md`**
> is *this document compiled with resolved literal token values* (hexes, sizes, durations) pulled
> from the children via the `tokens.md` pipeline. The two never compete: humans edit these
> children; agents read the compiled output. This file does not duplicate the children's tables —
> it summarises and points to them, and supplies the §1 atmosphere and §9 agent guide that only a
> parent can.

## Design principles

1. **Dark-first, light-adapted.** The deep navy canvas is the brand and the primary theme; light
   is a real but secondary theme adapted from the *same* token source (`tokens.md`).
2. **Graph-native.** The node/edge graph is the product's thesis and its recurring visual idea —
   from the mark to the canvas to the empty-states (`voice-and-imagery.md`).
3. **The gradient is an event, not a texture.** Vibrancy is *earned* by contrast with a calm navy
   base; gradient/glow/glass are reserved for brand moments and key surfaces (`color.md`).
4. **Colour is never alone.** Every kind pairs colour with a shape + glyph; every status pairs
   colour with icon + text (1.4.1) — `color.md`, `iconography.md`, `accessibility.md`.
5. **One token source.** No literal hex/px in app or catalogue code — only `var(--token)`; the
   contract is the `CE-BRAND-1` ≥90% conformance gate (`tokens.md`, `generative-ui.md`).
6. **Rich but disciplined motion.** GPU-only (transform/opacity), a small duration/easing scale,
   full `prefers-reduced-motion` fallbacks, an animated living graph as the signature moment
   (`tokens.md` `motion` tokens; [`motion.md`](motion.md) applied; `accessibility.md`).
7. **Restraint as a feature.** A small, absolute set of decisions (the Vercel/Geist tradition);
   5–9 core elements per surface, progressive disclosure, generous whitespace.
8. **Quality is gated, not asserted.** Lighthouse 100 across all four categories, WCAG 2.1 AA,
   axe-zero are the bars for the built Weave app (`tokens.md`, `accessibility.md`).

## Child standards (the authored source)

The value-bearing standards this north-star compiles from:

| Child | Owns |
|---|---|
| [`tokens.md`](tokens.md) | The token taxonomy, dark↔light theming, and the compile pipeline (the hub). |
| [`color.md`](color.md) | The navy ramp, brand spectrum + gradients, status, and the 14 BPMO kind palette (OKLCH dark/light variants, computed contrast, paired shapes — OQ-08). |
| [`typography.md`](typography.md) | Geist Sans + Geist Mono, the type scale, mono usage. |
| [`iconography.md`](iconography.md) | Icon style/grid/sizing, the kind shape rendering, the `--shape-kind-*` set, the node/edge motif construction. |
| [`voice-and-imagery.md`](voice-and-imagery.md) | Weave's house voice, logo usage, gradient/glow/glass narrative, illustration & empty-states. |
| [`motion.md`](motion.md) | The motion tokens applied: micro-interactions, page/route transitions, the signature living-graph keyframe bodies, the Framer Motion mapping, and per-animation reduced-motion fallbacks. |
| [`components.md`](components.md) | Per-component anatomy + state tables (button, input, card, badge, nav/tabs, modal, popover, toast, inspector, FAB, the first-class Cmd-K palette), glass-vs-flat elevation — aligned to the `generative-ui.md` catalogue. |
| [`layout-grid.md`](layout-grid.md) | The 8pt rhythm applied, breakpoint behaviour, the app-shell composition, the bento dashboard grid, container max-widths, density modes. |
| [`data-viz.md`](data-viz.md) | The living-graph node/edge aesthetic on Cytoscape.js + `GE-CANVAS-1`, the catalogue chart styling, the categorical series palette + heat ramp, and the accessible-data-viz rules. |

**Cross-referenced, not duplicated:** [`accessibility.md`](../accessibility.md) (WCAG AA,
contrast floors, ARIA, keyboard, reduced-motion, axe gate) and
[`generative-ui.md`](../generative-ui.md) (the finite component catalogue, `CE-BRAND-1` token +
VoiceRule consumption, conformance gate).

---

The nine sections below are the **`DESIGN.md` payload**. They are written for an agent: each is
concrete, each points to the child that carries the literal values, and §9 is the prompt guide.

## 1. Visual theme & atmosphere

Weave is **dark-first, vibrant-gradient, graph-native**. The canvas is a deep navy
(`--color-bg` `#0A0E14`); text is off-white (`--color-text-default` `#E5EAF2`), never pure white.
The brand is a full-spectrum gradient — **cyan → teal → magenta → purple → amber → lime → blue** —
lifted from the Weave mark, where the "W" is literally a node-graph rendered in that spectrum.

The mood is **premium, alive, and graph-native** (references: Linear's restraint and speed-feel,
x.ai's sharp dark drama, Vercel/Geist's absolute consistency). The base is calm and flat-fast; the
spectrum and glow appear only at moments of focus and brand — a graph lighting up, not a constant
wash. The signature moment is the **animated living graph**. Surfaces are flat with elevation by
lightening, not heavy shadow; glass and glow are reserved for the graph canvas, overlays, modals,
and the Cmd-K command palette.

## 2. Colour palette & roles

Full values, computed contrast, and the dark↔light variants are in [`color.md`](color.md); the
taxonomy and theming model are in [`tokens.md`](tokens.md). Roles:

- **Surface & elevation** — navy ramp `--color-bg` `#0A0E14` → `--color-surface` `#0E1420` →
  `--color-raised` `#131A28` → `--color-overlay` `#1A2236` → `--color-hover` `#1E2740`. Elevation
  is conveyed by lightening the surface.
- **Text** — `--color-text-default` `#E5EAF2` (≥13:1 on every surface), `--color-text-muted`
  `#8A95A8` (≥5.2:1), `--color-text-subtle` `#5C6779` (large-text/non-text only). Pure white is
  the wordmark + brand moments only.
- **Border** — `--color-border-soft` / `--color-border` `#1F2937` / `--color-border-strong`
  `#2A3550`; structural, never the sole carrier of meaning.
- **Brand spectrum** — seven OKLCH-tuned stops (`--color-brand-cyan` `#22D3EE` …
  `--color-brand-blue` `#60A5FA`), all ≥7:1 on navy; `--gradient-brand`, `--gradient-accent`.
- **Accent** — `--color-accent-primary` (cyan `#22D3EE` dark / `#0E7490` light), `-hover`, `-soft`.
- **Status** — `--color-success` `#10B981`, `--color-warn` `#F59E0B`, `--color-danger` `#EF4444`,
  `--color-info` `#7DD3FC`, each with a soft low-alpha bg; always paired with icon + text.
- **Kinds** — the 14 BPMO categorical colours (system of record), each a tuned OKLCH dark-variant
  ≥4.5:1 on navy, the PRD hex as the light value, **each paired with a shape + glyph** (OQ-08,
  rendered in `iconography.md`). Kinds own the data-viz palette; the brand gradient never does.

## 3. Typography

Full scale in [`typography.md`](typography.md). **Geist Sans** (UI) + **Geist Mono**
(code/IDs/metrics/numbers), variable, self-hosted, preloaded, `font-display: swap`. Type bundles
size + line-height + weight + tracking as one token (the Geist/Vercel token-as-class pattern):
`--text-display` `56px/1.05 w300` (gradient-clippable hero) down through `--text-h1` `36px/1.1 w700`,
`--text-body` `15px/1.5 w400` (default), to `--text-caption` `11px` (floor). Mono is **mandatory**
for IDs/IRIs, metrics/numbers, code/SPARQL, and kbd hints, with slashed-zero + tabular figures.
Headings clamp fluidly; body is fixed. Sentence case everywhere; all-caps only as the
`--text-overline` eyebrow device.

## 4. Component stylings

Per-component anatomy and state tables are owned by [`components.md`](components.md); the **AI-emitted
data-widget catalogue is defined in [`generative-ui.md`](../generative-ui.md)** (the finite,
pre-audited set — `KpiCard`, `LineChart`, `BarChart`, `RankedList`, `DataTable`, `ActivityFeed`,
`PieChart`/`DonutChart`, `Heatmap`, `AlertBanner`) and components consume `var(--token)` only. The
headline rules for every component:

- **Buttons** — `--radius-base`, `--space-3`/`--space-5` padding, `--font-weight-semibold`,
  `--text-body-sm`; primary uses `--color-accent-primary`; states use `-hover`/`-active`/`-soft`
  and `--ring-focus` on keyboard focus.
- **Cards & surfaces** — `--color-surface`, `--color-border`, `--radius-base`/`--radius-lg`,
  `--space-4`/`--space-5` padding, `--shadow-1`; flat-fast, no gradient fill.
- **Inputs** — `--color-surface`, `--color-border` → `--color-border-strong` on focus +
  `--ring-focus`; `aria-invalid` + `--color-danger` on error.
- **Badges/chips** — `--radius-sm`, `--text-caption`, kind/status colour **plus** shape/icon, never
  colour alone.
- **Overlays, modals, Cmd-K palette** — `--color-overlay`, `--radius-lg`, `--shadow-overlay`,
  glass permitted, trap + restore focus, `Escape` to close (`accessibility.md`). The **Cmd-K
  command palette is a first-class surface** (`--z-command`, above modals).

## 5. Layout principles

[`layout-grid.md`](layout-grid.md) owns this; the tokens are in [`tokens.md`](tokens.md). **8pt
spacing grid** (`--space-1` `4px` → `--space-12` `96px`); radii `--radius-sm` `4px` →
`--radius-xl` `20px`; breakpoints `--bp-sm` `640` → `--bp-2xl` `1536`. Whitespace-heavy, 5–9 core
elements per surface, progressive disclosure, **bento grids** for dense-but-ordered dashboards.
The app shell is a sticky topnav/subnav + a dockable side panel/inspector; reflow is usable at
320px (WCAG 1.4.10).

## 6. Depth & elevation

Flat-fast base. Elevation is conveyed by **lightening the surface**, not heavy shadow.
`--shadow-1` (raised), `--shadow-panel` (slide-in inspector), `--shadow-overlay` (modal / palette).
`--glow-brand` (cyan halo) is the **active/brand** signal only — the visual echo of a graph node
activating — never constant. `--ring-focus` is the one always-on elevation primitive (a11y, exempt
from the flat-base rule). Glass is reserved for canvas overlays, modals, and the command palette.

## 7. Do's & don'ts

- **DO** keep the navy calm; reserve gradient/glow/glass for brand moments and key surfaces.
- **DO** pair every kind/status colour with a shape or icon + a legend (1.4.1).
- **DO** consume `var(--token)` for all colour/type/space/radius — zero literal hex/px.
- **DO** animate only `transform`/`opacity` and ship a `prefers-reduced-motion` fallback.
- **DON'T** wash body text, cards, default buttons, or data-viz series in the brand gradient.
- **DON'T** use pure white for body text, stock photography, mascots, or "AI sparkle" clichés.
- **DON'T** distinguish a kind by colour or size alone; **DON'T** trap keyboard focus on the canvas.
- **DON'T** introduce a component outside the `generative-ui.md` catalogue in generated UI.

## 8. Responsive behaviour

Mobile-first; usable at **320px** with no horizontal scroll, no loss at **200% zoom**
(`accessibility.md`). Touch/interactive targets **≥24×24 px** (`iconography.md`). Subnav collapses
at `--bp-md`; the side panel docks at `--bp-lg`; full graph + inspector at `--bp-xl`; bento
dashboards at `--bp-2xl`. Display/h1/h2 are fluid (`clamp()`); body is fixed so reading measure is
stable. Images/illustration are SVG (the node/edge motif) and scale crisply.

## 9. Agent prompt guide

This is the section an agent reads to stay on-brand. The literal values resolve from
[`tokens.md`](tokens.md) at compile time.

**Quick reference**

- Canvas `--color-bg` `#0A0E14`; surface `#0E1420`; text `--color-text-default` `#E5EAF2`;
  accent `--color-accent-primary` cyan `#22D3EE`.
- Fonts: `--font-sans` Geist Sans (UI), `--font-mono` Geist Mono (IDs/metrics/code).
- Brand gradient (moments only): `--gradient-brand`
  `linear-gradient(100deg, #22D3EE, #2DD4BF, #E879F9, #A78BFA, #FBBF24, #A3E635, #60A5FA)`.
- Kind colour + shape: bind `--color-kind-{key}` **and** `--shape-kind-{key}` together; add the
  legend.

**Example component prompts**

- *Button (primary):* "Geist Sans 13px semibold, `--space-3`/`--space-5` padding,
  `--radius-base`, fill `--color-accent-primary`, `--ring-focus` on keyboard focus, sentence case."
- *KPI card:* "`--color-surface` card, `--radius-base`, `--shadow-1`, label in
  `--color-text-muted` `--text-label`, value in **Geist Mono** `--text-h2` tabular-nums."
- *Graph node:* "filled circle at `--color-kind-{key}`, kind shape/glyph inside, `--glow-brand`
  halo when active only; thin `--color-border` edges brightening to accent on focus."
- *Empty-state:* "node/edge line spot illustration on navy, one focal spectrum-haloed node, house
  voice one-liner, one primary action; static frame under reduced-motion."

**Iteration checklist (enforce before done)**

- [ ] Zero literal hex/px — only `var(--token)`; passes the `CE-BRAND-1` ≥90% gate.
- [ ] Every kind/status colour paired with shape/icon + legend (1.4.1).
- [ ] Contrast: body text ≥4.5:1, large/UI ≥3:1 (tokens are pre-verified in `color.md`).
- [ ] Keyboard reachable, visible focus, modals trap+restore + `Escape`, no canvas focus-trap.
- [ ] Motion is transform/opacity only with a `prefers-reduced-motion` fallback.
- [ ] Copy is Weave house voice (sentence case, active, AI-as-infrastructure); errors name cause +
      next action.
- [ ] axe zero violations; Lighthouse 100 (perf / a11y / best-practices / SEO).

## Cross-references (do not duplicate)

- [`tokens.md`](tokens.md) — the token hub, theming model, and the compile pipeline that turns this
  parent + children into the distributed `DESIGN.md` and the `CE-BRAND-1` token JSON.
- [`color.md`](color.md), [`typography.md`](typography.md), [`iconography.md`](iconography.md),
  [`voice-and-imagery.md`](voice-and-imagery.md) — the value-bearing children.
- [`accessibility.md`](../accessibility.md) — WCAG 2.1 AA, contrast floors, ARIA, keyboard, axe
  gate, reduced-motion (the gates this north-star commits to).
- [`generative-ui.md`](../generative-ui.md) — the finite component catalogue and the `CE-BRAND-1`
  token + VoiceRule consumption / conformance gate.

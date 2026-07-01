---
type: Coding Standard
title: Colour — Coding Standard
description: "The Weave colour system: the deep-navy surface/elevation ramp, text and border colours, the full-spectrum brand gradient and its usage rules, semantic status colours, and the 14 BPMO kind colours as tuned OKLCH dark/light variants with computed contrast-on-navy and paired shapes (resolving PRD OQ-08). All ratios are computed, not asserted."
tags: [standards, design, colour, brand, kinds, accessibility, frontend]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/color.md
---

# Colour

Weave is **dark-first**. The canvas is a deep navy, text is off-white, and the brand is a
full-spectrum gradient (cyan → teal → magenta → purple → amber → lime → blue) lifted directly from
the Weave mark — where the "W" is literally a node-graph rendered in that spectrum. This file owns
every colour value; [`tokens.md`](tokens.md) owns the structure and the compile pipeline.

**All contrast ratios below are computed** (WCAG 2.x relative-luminance formula) against the stated
background, not asserted. The base navy is `#0A0E14`. Contrast *floors* (which ratio applies where)
live in [`accessibility.md`](../accessibility.md) — this file proves the tokens clear them; it does
not restate the WCAG thresholds.

## Surface & elevation ramp (dark — primary)

The Blushift navy ramp is adopted as the base scaffold. Elevation is conveyed by *lightening the
surface*, not by heavy shadow — flat-fast surfaces keep Lighthouse-100. Shadow/glow is reserved for
overlays and brand moments (see `tokens.md` `shadow`).

| Token | Hex | OKLCH (L C H) | Role |
|---|---|---|---|
| `--color-bg` | `#0A0E14` | `0.162 0.014 258` | App canvas — deepest navy |
| `--color-surface` | `#0E1420` | `0.192 0.026 264` | Cards, panels, default surface |
| `--color-raised` | `#131A28` | `0.218 0.030 264` | Raised within a surface (toolbar, header) |
| `--color-overlay` | `#1A2236` | `0.255 0.040 267` | Modal / command-palette / popover base |
| `--color-hover` | `#1E2740` | `0.277 0.048 268` | Hover fill on interactive rows |
| `--color-raised-strong` | `#1B2434` | `0.260 0.033 262` | Selected / pressed surface |

## Text ramp (dark) — computed contrast

Body text uses off-white `#E5EAF2`, never pure white (eye-strain on true-dark). Every text token
clears its floor on every surface it is used on.

| Token | Hex | on `bg` | on `surface` | on `raised` | on `overlay` | Use |
|---|---|---|---|---|---|---|
| `--color-text-default` | `#E5EAF2` | 16.01 | 15.25 | 14.41 | 13.11 | Body, headings, primary content |
| `--color-text-muted` | `#8A95A8` | 6.40 | 6.09 | 5.76 | 5.24 | Secondary text, labels, captions |
| `--color-text-subtle` | `#5C6779` | 3.38 | 3.22 | 3.04 | 2.77 | Placeholder, disabled, non-text hints only |
| `--color-text-faint` | `#404B5E` | — | — | — | — | Decorative / dividers only — **never** for text |

- `--color-text-default` and `--color-text-muted` clear 4.5:1 on every surface up to `overlay`
  (body-text floor) — safe for all running text.
- `--color-text-subtle` clears 3:1 on `bg`, `surface`, and `raised` (3.04) and is for **large text
  (≥24px / ≥18.66px bold) or non-text UI hints**, not body copy. On `overlay` (2.77) it falls below
  3:1; use `--color-text-muted` on overlays.
- Pure white `#FFFFFF` on `bg` = 19.34 — reserved for the wordmark and brand moments only.

## Border ramp (dark)

Borders are structural, not text — they sit below the text floor by design (low-contrast dividers
read as calm). They are decorative; meaning is never carried by a border alone.

| Token | Hex | on `bg` | Use |
|---|---|---|---|
| `--color-border-soft` | `#161E2E` | 1.16 | Hairline divider inside a surface |
| `--color-border` | `#1F2937` | 1.32 | Default card / input border |
| `--color-border-strong` | `#2A3550` | 1.59 | Emphasised border, focused input edge |

## Brand spectrum + gradient

The seven spectrum stops are sampled from the Weave mark and tuned to OKLCH so each is vivid and
high-contrast on navy. These drive the brand gradient, the accent, the active-node glow, and the
living-graph moment. Every stop clears large-text/UI contrast on navy with wide margin.

| Stop | Hex | OKLCH (L C H) | contrast on navy |
|---|---|---|---|
| `--color-brand-cyan` | `#22D3EE` | `0.797 0.134 211.5` | 10.70 |
| `--color-brand-teal` | `#2DD4BF` | `0.785 0.133 181.9` | 10.39 |
| `--color-brand-magenta` | `#E879F9` | `0.748 0.207 322.2` | 7.86 |
| `--color-brand-purple` | `#A78BFA` | `0.709 0.159 293.5` | 7.11 |
| `--color-brand-amber` | `#FBBF24` | `0.837 0.164 84.4` | 11.59 |
| `--color-brand-lime` | `#A3E635` | `0.849 0.207 128.8` | 12.83 |
| `--color-brand-blue` | `#60A5FA` | `0.714 0.143 254.6` | 7.61 |

### Gradient definitions

| Token | Definition | Use |
|---|---|---|
| `--gradient-brand` | `linear-gradient(100deg, #22D3EE, #2DD4BF, #E879F9, #A78BFA, #FBBF24, #A3E635, #60A5FA)` | The full sweep — hero, the W mark, brand cards |
| `--gradient-brand-text` | same stops, clipped to text (`background-clip: text`) | Display headline accent only |
| `--gradient-accent` | `linear-gradient(120deg, #22D3EE, #A78BFA)` | Active node halo, primary-CTA sheen, focus moments |

### Accent (derived from the spectrum, replaces the prototype's bare purple)

| Token | Dark hex | Light hex | Note |
|---|---|---|---|
| `--color-accent-primary` | `#22D3EE` (cyan) | `#0E7490` | Primary interactive accent; light is darkened cyan for AA on white |
| `--color-accent-hover` | `#67E8F9` | `#0891B2` | Hover state |
| `--color-accent-soft` | `rgba(34,211,238,0.12)` | `rgba(14,116,144,0.10)` | Low-alpha fill behind active items |

### Gradient & glow usage rules (brand moments only)

The gradient is an **event, not a texture**. Overuse cheapens it and harms contrast and Lighthouse.

- **DO** use `--gradient-brand` on: the W mark, the hero/empty-state, the living-graph signature
  moment, the active/selected graph node halo, and the Cmd-K command-palette accent edge.
- **DO** reserve `--glow-brand` (`tokens.md`) and glass for key surfaces only: graph canvas,
  overlays, modals, command palette.
- **DON'T** put the gradient behind body text, on default buttons, on cards, or on data-viz series
  (kinds own the data-viz palette — never the brand gradient).
- **DON'T** animate the gradient where it competes with reading. `gradientDrift` is `linear`, slow,
  and has a `prefers-reduced-motion` static fallback.

## Semantic status colours

Status uses the Blushift status set, each with a soft low-alpha background. These are distinct from
both the brand spectrum and the kind palette so an "error" never reads as a "Process" node.

| Token | Dark hex | contrast on navy | Soft bg | Use |
|---|---|---|---|---|
| `--color-success` | `#10B981` | 7.62 | `rgba(16,185,129,0.10)` | success, healthy, passed |
| `--color-warn` | `#F59E0B` | 9.01 | `rgba(245,158,11,0.10)` | warning, degraded, attention |
| `--color-danger` | `#EF4444` | 5.14 | `rgba(239,68,68,0.10)` | error, blocked, failed |
| `--color-info` | `#7DD3FC` | 11.60 | `rgba(125,211,252,0.10)` | info, neutral notice |

Status is always paired with an icon and text (`AlertBanner` severity, toast `role="alert"`), never
colour alone — see `accessibility.md`.

## The 14 BPMO kind colours (the categorical system of record)

The 14 BPMO kind hexes from the Graph Explorer PRD (E1-S1 / FR-002) are the **canonical categorical
language** — the system of record the CE serves and the graph colours by. They are *not* re-sampled
from the brand spectrum (that would sacrifice mutual distinguishability across 14 categories).
Instead each is a **hybrid**: the PRD hue is preserved (so PRD/CE stay authoritative) but **tuned to
an OKLCH dark-variant** that (a) passes ≥3:1 on navy — and in fact we target **≥4.5:1** so kinds
read as confidently as the brand wants on the navy canvas — and (b) sits in the brand family by
holding hue and lifting lightness only. The **original PRD hex is kept as the light-theme value**
(darkened where needed for AA on white).

**Method (reproducible):** convert the PRD hex to OKLCH; lift `L` (holding hue `H`, trimming chroma
only as needed to stay in sRGB gamut) until contrast-on-`#0A0E14` ≥ 4.5:1. Light variant: take the
PRD hex, darken `L` until contrast-on-`#FFFFFF` ≥ 4.5:1. Ratios below are computed.

### Every kind passes ≥3:1 raw — but three are tight

A finding worth stating plainly: contrary to the initial research hypothesis, **all 14 raw PRD hexes
already clear 3:1 on `#0A0E14`** (the non-text/UI floor, WCAG 1.4.11). The research flagged System,
BusinessDomain, and Policy as likely failures — the computed ratios show they *pass but are the
tightest*: **Policy `#be185d` = 3.20**, **BusinessDomain `#7c3aed` = 3.39**, **System `#2563eb` =
3.74**. Those three therefore take the **biggest tuning shift** to reach the confident ≥4.5:1 bar.
The raw `Process #dc2626` (4.00) also gets a small lift.

### Kind palette table

`Δ` is the OKLCH lightness lift from raw PRD hex to the tuned dark variant. Dark contrast is on
`#0A0E14`; light contrast is on `#FFFFFF`.

Each kind is identified by **silhouette + interior glyph** (the two together, so no two kinds rely on
size or stroke alone). The `Shape · glyph` column gives both.

| Kind | PRD hex (orig) | raw c/navy | **Dark variant** (OKLCH → hex) | dark c/navy | **Light variant** | light c/white | Δ L | Shape · glyph |
|---|---|---|---|---|---|---|---|---|
| Process | `#dc2626` | 4.00 | `oklch(0.607 0.215 27)` → `#E73430` | **4.54** | `#DC2626` | 4.83 | +0.03 | filled hexagon · flow-arrow |
| Activity | `#f59e0b` | 9.01 | `oklch(0.769 0.165 70)` → `#F59E0B` | **9.01** | `#B36100` | 4.54 | 0 | rounded-rect · play |
| Event | `#0ea5e9` | 6.98 | `oklch(0.685 0.148 237)` → `#0EA5E9` | **6.98** | `#007CBE` | 4.54 | 0 | diamond · lightning |
| Actor | `#0d9488` | 5.17 | `oklch(0.600 0.104 185)` → `#0D9488` | **5.17** | `#008579` | 4.53 | 0 | circle · person |
| Goal | `#ca8a04` | 6.58 | `oklch(0.681 0.142 76)` → `#CA8A04` | **6.58** | `#A66800` | 4.56 | 0 | star · target/bullseye |
| Policy | `#be185d` | **3.20** | `oklch(0.605 0.199 4)` → `#DB3B74` | **4.50** | `#BE185D` | 6.04 | **+0.08** | shield · checkmark |
| BusinessDomain | `#7c3aed` | **3.39** | `oklch(0.611 0.247 293)` → `#9054FF` | **4.51** | `#7C3AED` | 5.70 | **+0.07** | rounded-square · folder |
| BusinessCapability | `#db2777` | 4.21 | `oklch(0.612 0.218 1)` → `#E2307D` | **4.56** | `#DB2777` | 4.60 | +0.02 | pentagon · grid/blocks |
| System | `#2563eb` | **3.74** | `oklch(0.591 0.215 263)` → `#3272FB` | **4.55** | `#2563EB` | 5.17 | **+0.05** | sharp square · CPU-chip |
| Service | `#0891b2` | 5.25 | `oklch(0.609 0.111 222)` → `#0891B2` | **5.25** | `#0080A1` | 4.56 | 0 | gear/cog (toothed) |
| DataAsset | `#16a34a` | 5.87 | `oklch(0.627 0.170 149)` → `#16A34A` | **5.87** | `#008830` | 4.60 | 0 | cylinder · database |
| Concept | `#ea580c` | 5.43 | `oklch(0.646 0.194 41)` → `#EA580C` | **5.43** | `#D54300` | 4.53 | 0 | ring (open circle) · lightbulb |
| Field | `#65a30d` | 6.26 | `oklch(0.648 0.175 132)` → `#65A30D` | **6.26** | `#498500` | 4.53 | 0 | tag · attribute-dot |
| Class | `#d97706` | 6.07 | `oklch(0.666 0.157 58)` → `#D97706` | **6.07** | `#BB5B00` | 4.56 | 0 | triangle · type-T |
| _fallback_ | `#64748b` | 4.06 | `oklch(0.584 0.041 257)` → `#6D7D94` | **4.62** | `#64748B` | 4.76 | +0.03 | dotted-circle · question-mark |

Tokens: `--color-kind-process`, `--color-kind-activity`, … `--color-kind-class`,
`--color-kind-fallback` (dark `:root`; light values under `@media prefers-color-scheme: light`).
`Process` keeps its prominent red and is the visually first-class kind (PRD FR-002).

### Biggest shifts — flagged

The three kinds that needed real tuning to reach ≥4.5:1 on navy, in order:

1. **Policy `#be185d` → `#DB3B74`** (Δ L +0.08, raw 3.20). The largest shift; the deep crimson-pink
   was the darkest hue on navy. Tuned variant is a brighter rose, hue held at ~4°.
2. **BusinessDomain `#7c3aed` → `#9054FF`** (Δ L +0.07, raw 3.39). The signature violet lifted into a
   vivid brand-purple that sits cleanly in the spectrum family.
3. **System `#2563eb` → `#3272FB`** (Δ L +0.05, raw 3.74). The blue brightened a notch.

All other kinds were already ≥4.5:1 (or close enough that a sub-0.03 lift suffices) and keep their
PRD hex essentially unchanged in dark mode.

### Why colour alone is never enough — paired shapes (resolves OQ-08)

WCAG 1.4.1 forbids colour as the only carrier of meaning, and 14 categorical hues exceed the
reliable perceptual limit even when each clears contrast. **Each kind therefore gets a paired
shape + interior glyph (the `Shape · glyph` column above), a `--shape-kind-*` token, and a legend
entry** so a kind is identifiable without colour — in greyscale or for colour-blind users. This is
the design system's proposed resolution to PRD **OQ-08** (kind→shape mapping), handed back to the
Architect/PO:

- **Silhouette first, glyph second.** Most kinds are distinct by outline alone (hexagon, diamond,
  cylinder, triangle, shield, star, pentagon, gear, tag). Where outlines would be close —
  Actor (circle) vs Concept (ring) vs fallback (dotted-circle), and BusinessDomain (rounded-square)
  vs System (sharp square) — the **interior glyph carries the distinction** (person vs lightbulb vs
  question-mark; folder vs CPU-chip), and the legend always labels them. No kind is distinguished by
  *size alone*: the earlier diamond/small-diamond clash is removed — Field is now a **tag**, not a
  smaller diamond.
- `Process` (first-class) gets the most prominent filled hexagon; the unknown/extension `fallback`
  gets a neutral dotted-circle + question-mark so client-extension kinds read as "uncategorised",
  not as a real kind.
- The graph canvas (Cytoscape.js) renders shape + glyph + fill + label; the side-panel legend maps
  shape+glyph+colour→kind name. This satisfies 1.4.1 *and* the PRD's "single ellipse in v1,
  kind→shape deferred" note — the design system unblocks the upgrade from ellipse-only. At extreme
  zoom-out where a glyph is sub-pixel, the legend and the node label remain the non-colour fallback.

## Cross-references (do not duplicate)

- [`tokens.md`](tokens.md) — taxonomy, naming, the dark↔light theming model, compile pipeline.
- [`accessibility.md`](../accessibility.md) — the WCAG 2.1 AA contrast *floors* these tokens are
  computed against, the non-colour-encoding rule, axe gate, legend requirement.
- [`generative-ui.md`](../generative-ui.md) — `CE-BRAND-1` token consumption; catalogue components
  read these as `var(--color-*)` with zero hard-coded hex.
- [`typography.md`](typography.md) — text uses these colour tokens; type sizes set which contrast
  floor applies.

---
type: Coding Standard
title: Iconography — Coding Standard
description: "The Weave icon system: line/duotone icon style, the 24px grid and sizing scale, stroke and corner rules, the per-kind shape + glyph set that renders the canonical mapping from color.md (resolving PRD OQ-08), the --shape-kind-* token set, and the node/edge brand-motif glyph construction from the Weave mark."
tags: [standards, design, iconography, icons, shapes, kinds, accessibility, frontend]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/iconography.md
---

# Iconography

Icons in Weave do two jobs: they are the everyday UI glyph set (toolbar actions, nav, status),
and they are the **non-colour carrier of meaning** for the 14 BPMO kinds — the silhouette + glyph
that lets a kind be read in greyscale or by a colour-blind user (WCAG 1.4.1). This file owns the
*rendering* of those shapes; [`color.md`](color.md) owns the **mapping** (which shape belongs to
which kind) and is the system of record. Where the two could ever disagree, `color.md` wins.

The brand motif is the **node/edge graph** lifted from the Weave mark — a filled node with a soft
halo, joined by a thin edge. That motif governs how the kind shapes, the logo, and the
living-graph moment are drawn.

## Icon style — line, with duotone for kinds

Two registers, one geometry:

- **Line (default).** A single-weight outline stroke. Used for all UI/action icons — toolbar,
  nav, inline affordances, kbd hints, empty-state spot illustrations. Quiet, flat, fast.
- **Duotone (kinds + brand moments only).** A line silhouette plus one low-alpha fill of the
  kind colour. Reserved for the **kind shapes** (so a node reads as a filled, glowing object on
  the graph) and brand moments. Duotone is never used for ordinary UI actions — that keeps the
  graph's filled-node language distinct from the flat action language.

Icons are monochrome by default and inherit `currentColor`, so a UI icon takes the surrounding
text token (`--color-text-default` / `--color-text-muted`). Kind shapes take their
`--color-kind-*` value (`color.md`) as the duotone fill + stroke. No icon hard-codes a hex.

### Library

Use a single open, MIT/ISC-licensed line set as the UI base — **Lucide** (the React-native
successor to Feather; tree-shakeable, one `<svg>` per icon, no icon-font request — a
Lighthouse/Best-Practices win). The 15 kind shapes (below) are a **bespoke Weave set** built on
the same grid, because no off-the-shelf set carries the BPMO silhouettes; they live in the
component catalogue as inline SVG, never as a font glyph.

## Grid & construction

All icons — UI and kind — are drawn on a **24×24 grid** with a **1.5px live area inset** (so the
drawable box is 21×21, leaving a 1.5px optical margin on every edge). This matches the Lucide
grid, so the bespoke kind set and the imported UI set are visually coherent.

| Property | Value | Note |
|---|---|---|
| Grid | `24 × 24` | Authoring viewBox `0 0 24 24` |
| Live-area inset | `1.5px` | Keep all strokes inside; nothing touches the edge |
| Stroke width | `1.5px` at 24px (authoring default) | The *render* stroke follows the sizing scale below (e.g. `1.75px` at `--icon-lg`); never below `1.25px` rendered |
| Stroke join / cap | `round` / `round` | Soft, matches the node/edge motif |
| Corner radius (geometry) | `2px` on rectilinear shapes | Echoes `--radius-sm`; no sharp UI corners except the System kind |
| Alignment | Optically centred | Centre by visual mass, not bounding box |

Strokes are **non-scaling** in spirit: when an icon renders at a non-24 size, the SVG scales but
stroke width is held to the size-mapped value below so weight stays even.

## Sizing scale

Icon sizes are tokens, not arbitrary pixels — they pair with the type scale
([`typography.md`](typography.md)) and the touch-target floor ([`accessibility.md`](../accessibility.md)).

| Token | Size | Stroke | Use |
|---|---|---|---|
| `--icon-xs` | `12px` | `1.25px` | Inline-with-caption, dense table glyph, chip leading icon |
| `--icon-sm` | `16px` | `1.5px` | Inline-with-body, button leading icon, menu item |
| `--icon-base` | `20px` | `1.5px` | Default toolbar / nav icon |
| `--icon-lg` | `24px` | `1.75px` | Section header, prominent action |
| `--icon-xl` | `32px` | `2px` | Empty-state, feature tile, kind legend swatch |

- **Touch target:** an icon-only control pads to **≥24×24 CSS px** of hit area regardless of glyph
  size (WCAG 2.5.8, `accessibility.md`) — a 16px icon sits in a 24px (or larger) button.
- **Decorative vs meaningful:** a purely decorative icon is `aria-hidden="true"`; an icon that
  *is* the control's meaning carries the accessible name on the control, not the SVG
  (`accessibility.md` ARIA rules).
- Kind shapes on the graph canvas scale with zoom; at extreme zoom-out where the interior glyph
  is sub-pixel, the node label + legend remain the non-colour fallback (`color.md`).

## The BPMO kind shapes (rendering the OQ-08 mapping)

The kind→shape mapping is **owned by [`color.md`](color.md)** (the `Shape · glyph` column of the
kind table) and is the resolution to PRD **OQ-08**. This file does not choose shapes — it
**reproduces the mapping verbatim** and specifies how each is drawn. The pairing is
**silhouette first, interior glyph second**: most kinds are distinct by outline alone; where
outlines are close, the interior glyph carries the distinction and the legend always labels it.

| Kind | Silhouette | Interior glyph | Drawing note |
|---|---|---|---|
| Process | filled hexagon | flow-arrow | First-class kind (PRD FR-002) — drawn largest / most prominent |
| Activity | rounded-rect | play | Corners at `2px`; play triangle centred |
| Event | diamond | lightning | Square rotated 45°; lightning bolt inset |
| Actor | circle | person | Solid circle; bust glyph distinguishes from Concept/fallback |
| Goal | star | target / bullseye | 5-point star; concentric-ring target glyph |
| Policy | shield | checkmark | Heater-shield outline; check inset |
| BusinessDomain | rounded-square | folder | `2px` corners; folder glyph distinguishes from System |
| BusinessCapability | pentagon | grid / blocks | Upright pentagon; 2×2 block glyph |
| System | sharp square | CPU-chip | **The one sharp-cornered shape** (0px radius); chip + pins glyph |
| Service | gear / cog (toothed) | — | Toothed cog; silhouette is self-sufficient, no interior glyph |
| DataAsset | cylinder | database | Database barrel with top ellipse |
| Concept | ring (open circle) | lightbulb | Open ring distinguishes from Actor (solid); bulb inset |
| Field | tag | attribute-dot | Luggage-tag silhouette with the punch-hole dot |
| Class | triangle | type-T | Upward triangle; serif "T" glyph |
| _fallback_ | dotted-circle | question-mark | Unknown / client-extension kind — reads as "uncategorised" |

Disambiguation rules (carried from `color.md`, restated so the renderer is unambiguous):

- **Actor (solid circle) vs Concept (open ring) vs fallback (dotted-circle)** — the fill/stroke
  treatment of the circle is the primary tell; the interior glyph (person / lightbulb /
  question-mark) confirms it.
- **BusinessDomain (rounded-square) vs System (sharp square)** — the corner radius differs
  (`2px` vs `0px`) and the interior glyph (folder vs CPU-chip) confirms it. System is the *only*
  kind drawn with sharp corners, so its silhouette is deliberately the odd one out.
- **No kind is distinguished by size alone.** Field is a **tag**, not a small diamond — the
  earlier diamond/small-diamond clash is removed.

### `--shape-kind-*` tokens

Each kind has a shape token paired with its colour token, so a component binds both from one
kind key. `tokens.md` references this set in the naming convention.

| Token | Resolves to | Pairs with |
|---|---|---|
| `--shape-kind-process` | hexagon SVG `id` | `--color-kind-process` |
| `--shape-kind-activity` | rounded-rect SVG `id` | `--color-kind-activity` |
| `--shape-kind-event` | diamond SVG `id` | `--color-kind-event` |
| `--shape-kind-actor` | circle SVG `id` | `--color-kind-actor` |
| `--shape-kind-goal` | star SVG `id` | `--color-kind-goal` |
| `--shape-kind-policy` | shield SVG `id` | `--color-kind-policy` |
| `--shape-kind-business-domain` | rounded-square SVG `id` | `--color-kind-business-domain` |
| `--shape-kind-business-capability` | pentagon SVG `id` | `--color-kind-business-capability` |
| `--shape-kind-system` | sharp-square SVG `id` | `--color-kind-system` |
| `--shape-kind-service` | gear SVG `id` | `--color-kind-service` |
| `--shape-kind-data-asset` | cylinder SVG `id` | `--color-kind-data-asset` |
| `--shape-kind-concept` | ring SVG `id` | `--color-kind-concept` |
| `--shape-kind-field` | tag SVG `id` | `--color-kind-field` |
| `--shape-kind-class` | triangle SVG `id` | `--color-kind-class` |
| `--shape-kind-fallback` | dotted-circle SVG `id` | `--color-kind-fallback` |

The shape token's `$value` is a stable shape `id` (the catalogue resolves it to the inline SVG),
not a colour. The Cytoscape.js renderer (the graph's real render tech) maps `kind → shape id +
glyph + fill + label`; the legend maps `shape + glyph + colour → kind name`.

## The node/edge brand motif

The Weave mark is a node-graph: filled nodes joined by thin edges, each node carrying a soft
spectrum halo. This motif is the construction rule for graph nodes, the logo, and the
living-graph moment.

- **Node.** A filled circle (`--radius-full`) at the kind colour, with the kind shape/glyph
  inside for non-circle kinds rendered as a badge. Selected/active nodes carry `--glow-brand`
  (`tokens.md`) — the soft outer halo; default nodes have no glow (flat-fast).
- **Edge.** A thin line at a low-contrast border token by default
  (`--color-border` / `--color-border-strong`), brightening toward the accent on focus/trace
  (`color.md` "active/glow"). Edges never carry the brand gradient as a texture.
- **Halo.** The spectrum halo (`--gradient-accent`, cyan→purple) is the *active* signal only —
  it is how the graph echoes the W mark at the moment of focus, not a constant decoration.

Generated and hand-built graph chrome reuse this motif; they do not invent a second node style.

## Definition of done (iconography)

- [ ] Icon is line (UI) or duotone (kind / brand) on the 24×24 grid with `round` join/cap.
- [ ] Size is an `--icon-*` token; stroke matches the size row; icon-only control hit-area
      ≥ 24×24 px.
- [ ] Colour is `currentColor` (UI) or a `--color-kind-*` token (kind) — no literal hex.
- [ ] A kind shape matches the `color.md` kind table exactly (silhouette + glyph); no re-decided
      shapes; the `--shape-kind-*` token is bound alongside `--color-kind-*`.
- [ ] Decorative icons are `aria-hidden`; meaningful ones name the control, not the SVG.
- [ ] Kind encoding is never colour-only — shape + glyph + legend present (`accessibility.md`).

## Cross-references (do not duplicate)

- [`color.md`](color.md) — **the system of record for the kind→shape mapping** (OQ-08), kind
  colours, and the gradient/glow/halo usage rules this file's motif obeys.
- [`tokens.md`](tokens.md) — the `--shape-kind-*` and `--icon-*` token taxonomy, naming, and the
  `--radius-*` / `--glow-brand` tokens referenced here.
- [`accessibility.md`](../accessibility.md) — the 24×24 target-size floor, the colour-not-alone
  rule, the legend requirement, and decorative-icon ARIA.
- [`generative-ui.md`](../generative-ui.md) — the catalogue components that consume these icons /
  shapes as `var(--token)` with zero hard-coded values.
- [`design.md`](design.md) — the parent north-star and the compiled `DESIGN.md` agents consume.

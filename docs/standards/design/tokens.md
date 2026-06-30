---
type: Coding Standard
title: Design Tokens — Coding Standard
description: "The single DTCG-shaped design-token taxonomy for Weave (colour, type, space, radius, shadow/glow, motion, z-index, breakpoint), the dark-first ↔ light theming model from one source, and the compile pipeline from this spec to DTCG tokens.json → CSS custom properties + the CE-BRAND-1 GET /api/brand/tokens JSON."
tags: [standards, design, tokens, dtcg, frontend, brand]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/tokens.md
---

# Design Tokens

This is the **token hub** of the Weave design system. It defines the one token taxonomy, the
naming convention, the dark-first ↔ light theming model, and the **compile pipeline** that turns
this human-authored spec into the machine artefacts everything else consumes.

The design system is **dark-first, vibrant-gradient, graph-native**: a deep navy canvas, a
full-spectrum brand gradient (cyan → teal → magenta → purple → amber → lime → blue), white text,
and the node/edge motif from the Weave mark. Dark is the primary theme; light is a real but
secondary theme adapted from the *same* source. Premium, alive, graph-native — references: Linear,
x.ai, Vercel.

`color.md` and `typography.md` are the two value-bearing children of this hub. This file owns the
**structure and the pipeline**; they own the **palette and the type scale**. Nothing here restates
WCAG numbers — those live in [`accessibility.md`](../accessibility.md).

## The spec is the source; tokens.json is the artefact

Weave already has a token *contract*: **`CE-BRAND-1`** — `GET /api/brand/tokens` returns flattened
design-token JSON projected from RDF brand individuals "so Build can consume tokens without parsing
RDF", versioned and PROV-stamped, and generated UI is **conformance-gated at ≥90% adherence (no
critical violations)** (Build PRD FR-029; see [`generative-ui.md`](../generative-ui.md)).

Therefore this design spec is **not a free-standing style doc**. It is the human-authored source of
truth that compiles to two machine targets:

1. **DTCG `tokens.json`** — the W3C Design Tokens Community Group interchange format (stable Oct
   2025), the shape Figma / Tokens Studio / Style Dictionary all speak, and the shape `CE-BRAND-1`
   emits.
2. From that one file: **(a)** CSS custom properties for the Weave SPA, and **(b)** the flattened
   `CE-BRAND-1` `/api/brand/tokens` JSON the Build Engine consumes.

```text
docs/standards/design/*.md   (human source — this dir)
            │  author
            ▼
   tokens.json  (DTCG, W3C — one source of truth)
       ├──► Style Dictionary ──► app.css   (:root + @media prefers-color-scheme → CSS custom properties)
       └──► brand-projection ──► CE-BRAND-1  GET /api/brand/tokens   (flattened JSON, PROV-stamped)
                                      │  conformance-gated ≥90%, no critical violations (Build FR-029)
                                      ▼
                           Build-generated UI + Generative Dashboard
```

A second generated artefact, **`DESIGN.md`** (x.ai / Google-Stitch 9-section format), is compiled
from these children for agent consumption. Children are *authored*; `DESIGN.md` and `tokens.json`
are *generated*. They never compete — see the build step below.

## DTCG authoring shape

Author every token as a DTCG node: a `$type` and a `$value`, optionally `$description`. Reference
other tokens with `{group.token}` alias syntax. Group with nested objects.

```json
{
  "color": {
    "navy": {
      "bg":      { "$type": "color", "$value": "#0A0E14", "$description": "App canvas — deepest navy" },
      "surface": { "$type": "color", "$value": "#0E1420" }
    },
    "text": {
      "default": { "$type": "color", "$value": "#E5EAF2" }
    },
    "accent": {
      "primary": { "$type": "color", "$value": "{color.brand.cyan}" }
    }
  },
  "space": {
    "4": { "$type": "dimension", "$value": "16px" }
  },
  "motion": {
    "duration": {
      "base": { "$type": "duration", "$value": "200ms" }
    }
  }
}
```

DTCG `$type` values used by Weave: `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`,
`cubicBezier`, `number`, `shadow`, plus a `typography` composite. OKLCH is the canonical colour
space for *authoring* and reasoning (W3C DTCG v1 mandates it, HSL is deprecated for pro systems);
each colour token carries a hex `$value` as the gamut-safe fallback for the emitted CSS. `color.md`
documents both the OKLCH and the hex for every brand/kind colour.

## Token taxonomy

Eight top-level groups. Every Weave value lives in exactly one. No literal hex or px may appear in
application or catalogue code — only `var(--token)`.

| Group | DTCG `$type` | Owns | Defined in |
|---|---|---|---|
| `color` | `color` | Navy ramp, surface/elevation, text/border, brand spectrum + gradients, semantic status, the 14 BPMO kinds | [`color.md`](color.md) |
| `typography` | `fontFamily` / `fontWeight` / `dimension` / composite | Geist Sans + Geist Mono families, the size/line-height/weight/tracking scale, responsive scale | [`typography.md`](typography.md) |
| `space` | `dimension` | The 8pt spacing grid | this file |
| `radius` | `dimension` | Corner radii | this file |
| `shadow` | `shadow` | Elevation shadows + brand glow + focus ring | this file |
| `motion` | `duration` / `cubicBezier` | Duration scale, easing scale, named keyframes contract | this file (+ `accessibility.md` reduced-motion row) |
| `zIndex` | `number` | Stacking order | this file |
| `breakpoint` | `dimension` | Responsive breakpoints | this file |

### `space` — 8pt grid

One base unit (`4px`) and a geometric-ish ramp; everything is a multiple of 4, the rhythm is 8.
This matches the x.ai `4 / 8 / 24 / 48` density and the prototype layout.

| Token | Value | Typical use |
|---|---|---|
| `--space-0` | `0` | reset |
| `--space-1` | `4px` | icon gap, chip inner gap |
| `--space-2` | `8px` | tight stack, input padding-y |
| `--space-3` | `12px` | button padding-y, card inner gap |
| `--space-4` | `16px` | card padding, default stack gap |
| `--space-5` | `24px` | section gap, panel padding |
| `--space-6` | `32px` | block gap |
| `--space-8` | `48px` | major section gap |
| `--space-10` | `64px` | hero / page-shell padding |
| `--space-12` | `96px` | landing rhythm |

### `radius`

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `4px` | chips, inputs, badges (Blushift baseline) |
| `--radius-base` | `8px` | buttons, cards, surfaces |
| `--radius-lg` | `12px` | panels, modals, command palette |
| `--radius-xl` | `20px` | hero / brand cards |
| `--radius-full` | `9999px` | pills, avatars, graph node dot |

### `shadow` — elevation + glow + ring

Flat-fast base, glow/glass reserved for key surfaces (graph canvas, overlays, modals, Cmd-K) and
brand moments — so Lighthouse-100 and WCAG-AA hold (see `color.md` "glow usage" and `motion.md`).

| Token | Value | Use |
|---|---|---|
| `--shadow-1` | `0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)` | raised surface (Blushift) |
| `--shadow-panel` | `-16px 0 40px rgba(0,0,0,0.45)` | slide-in side panel / inspector |
| `--shadow-overlay` | `0 16px 48px rgba(0,0,0,0.55)` | modal, command palette, popover |
| `--glow-brand` | `0 0 24px rgba(34,211,238,0.30)` | brand-moment / active-node halo (cyan stop) |
| `--ring-focus` | `0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent-primary)` | keyboard focus ring (≥3:1, WCAG 2.4.7) |

`--ring-focus` is the one elevation token that is **always on** — it is an accessibility primitive,
not decoration, and is exempt from the reduced-motion / flat-base rule.

### `motion`

Duration and easing are the two scales; named keyframes are a closed contract. Only
`transform`/`opacity` animate (GPU-friendly). `motion.md` (a sibling child, when authored) and
[`accessibility.md`](../accessibility.md) own the full reduced-motion fallback; the tokens are:

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | `80ms` | state echo (active press) |
| `--duration-fast` | `140ms` | hover, focus, chip toggle |
| `--duration-base` | `200ms` | enter/exit, panel slide, route transition |
| `--duration-slow` | `320ms` | modal / command-palette reveal, hero |
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | natural in/out (Blushift `panel-enter`) |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | enter from rest (decelerate) |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | exit to rest (accelerate) |
| `--ease-linear` | `linear` | off-screen / continuous (shimmer, gradient drift) |

The four-step scale above is for **interactive** transitions. The continuous/ambient brand loops
sit outside it (they are ambient, not interactive) and have their own named durations:

| Token | Value | Use |
|---|---|---|
| `--duration-pulse` | `2000ms` | `pulseGlow` active/running halo loop |
| `--duration-shimmer` | `1200ms` | `shimmer` skeleton sweep loop |
| `--duration-breathe` | `6000ms` | `livingGraph` idle graph drift loop |
| `--duration-drift` | `12000ms` | `gradientDrift` brand-surface gradient loop |

Named keyframes (carried from Blushift, GPU-friendly only): `fadeIn`, `slideInPanel`, `pulseGlow`,
`shimmer`, plus the signature `livingGraph` (the animated graph brand moment) and `gradientDrift`
(brand surface). **Every keyframe ships a `@media (prefers-reduced-motion: reduce)` no-op or
crossfade fallback** — this is a hard gate, cross-referenced to `accessibility.md` (Motion row).

### `zIndex`

| Token | Value | Layer |
|---|---|---|
| `--z-base` | `0` | content |
| `--z-canvas-overlay` | `10` | graph mini-map, legend, canvas toolbar |
| `--z-sticky` | `100` | sticky topnav / subnav |
| `--z-panel` | `200` | side panel / inspector |
| `--z-overlay` | `300` | scrims |
| `--z-modal` | `400` | modals |
| `--z-command` | `500` | Cmd-K command palette (always above modals) |
| `--z-toast` | `600` | toasts / `aria-live` alerts |

### `breakpoint`

Mobile-first; the SPA reflows usable at 320px (WCAG 1.4.10, see `accessibility.md`).

| Token | Min-width | Target |
|---|---|---|
| `--bp-sm` | `640px` | large phone / small tablet |
| `--bp-md` | `768px` | tablet — subnav collapses |
| `--bp-lg` | `1024px` | laptop — side panel docks |
| `--bp-xl` | `1280px` | desktop — full graph + inspector |
| `--bp-2xl` | `1536px` | wide — bento dashboards |

## Naming convention

`--{group}-{role}[-{variant}][-{state}]`, kebab-case, semantic-not-literal.

- **Semantic over literal:** `--color-accent-primary`, never `--color-cyan-500` in app code. The
  literal ramp exists inside `tokens.json` (e.g. `color.brand.cyan`); app surfaces reference the
  *role* alias so a re-theme is a token edit, not a find-replace.
- **State suffix** for interactive variants: `-hover`, `-active`, `-soft` (low-alpha fill),
  `-strong`.
- **Kinds** are addressed by their BPMO key: `--color-kind-process`, `--color-kind-system`, …,
  `--color-kind-fallback` (see `color.md`). Each kind also has a paired `--shape-kind-*` glyph
  token (resolving PRD OQ-08).
- DTCG group path maps 1:1 to the CSS variable: `color.accent.primary` → `--color-accent-primary`.

## Dark-first ↔ light theming — one source, two themes

There is **one** token source. Theme is a *value layer*, not a second token set: the dark values
land on `:root`; the light values override the **same** custom-property names under
`@media (prefers-color-scheme: light)`. Component CSS never branches on theme — it only ever reads
`var(--color-surface)` etc.

```css
:root {
  /* dark — PRIMARY theme (the brand) */
  --color-bg:           #0A0E14;
  --color-surface:      #0E1420;
  --color-text-default: #E5EAF2;
  --color-accent-primary: #22D3EE; /* brand cyan */
  /* …all dark values… */
}

@media (prefers-color-scheme: light) {
  :root {
    /* light — SECONDARY, adapted from the same source */
    --color-bg:           #F8FAFC;
    --color-surface:      #FFFFFF;
    --color-text-default: #0F172A;
    --color-accent-primary: #0E7490; /* darkened cyan for AA on white */
    /* …all light values… */
  }
}
```

The three existing sources reconcile as follows (see `color.md` for the full table):

| Source | Role in the system |
|---|---|
| `prototypes/Blushift/styles.css` (dark navy `#0A0E14` ramp + glows + keyframes) | **The dark base scaffold.** Closest existing thing to target; surfaces, text ramp, shadows, keyframes are adopted nearly verbatim. |
| `prototypes/weave-prototype/.../tokens.css` (light, purple `#7c3aed` accent, `--kind-*` subset) | **Re-mapped as the light theme.** Its light tokens become the `prefers-color-scheme: light` override; its bare-purple accent is replaced by the brand-derived accent. Its `--kind-*` set is a subset of the canonical 14. |
| Brand mark / `logo.png` (navy + full-spectrum gradient + node motif) | **The identity layer.** Supplies `color.brand.*` spectrum stops, gradient defs, the accent, and the glow. |

DTCG carries both themes either via the `$extensions` theming convention or two value files merged
at build (`tokens.dark.json` + `tokens.light.json` over a shared `tokens.base.json`). Dark is base;
light is the override set. A `[data-theme]` attribute hook may layer on top of `prefers-color-scheme`
for an explicit user toggle, but `prefers-color-scheme` is the default contract.

## Compile pipeline (normative)

1. **Author** these markdown children. `color.md` and `typography.md` carry the literal values;
   `tokens.md` carries structure/motion/space/etc.
2. **Extract → `tokens.json`** (DTCG). One base file plus dark/light value layers. This is the
   single machine source. The extraction is mechanical: every table row with a `--token` becomes a
   DTCG node. (Hand-maintained until a doc-extractor exists; `tokens.json` is the gate, not the
   prose.)
3. **Style Dictionary → `app.css`.** Emits `:root` (dark) + `@media (prefers-color-scheme: light)`
   custom properties. Tailwind maps the same tokens to utility classes (the Geist/Vercel
   token-as-class pattern; see `typography.md`).
4. **Brand projection → `CE-BRAND-1`.** The CE projects the brand individuals to the flattened
   `GET /api/brand/tokens` JSON. `tokens.json` and the CE projection must agree: the design
   `tokens.json` is the *authoring* source; the CE response is the *runtime* contract the Build
   Engine reads at a project-pinned version, PROV-stamped (CE PRD FR-016). A brand individual that
   fails its SHACL shape never appears in tokens.
5. **Compile → `DESIGN.md`.** The agent-consumable 9-section x.ai/Stitch document (Visual Theme,
   Color & Roles, Typography, Components, Layout, Depth/Elevation, Do's & Don'ts, Responsive, Agent
   Prompt Guide) is generated from these children + `tokens.json`. Agents read `DESIGN.md`; humans
   edit the children.

### Versioning & provenance

Every token change is versioned and PROV-stamped at the `CE-BRAND-1` boundary (CE PRD FR-016). The
dashboard and Build read tokens at a **project-pinned version** so a brand edit never silently
re-skins a published artefact (`generative-ui.md`). Bump semantics: a colour/scale *value* change is
a minor bump; adding or removing a token *name* (e.g. a new kind, a renamed role) is a major bump,
because it changes the contract the conformance gate evaluates against.

## Conformance — how tokens are gated

This is enforced by **existing** machinery (`generative-ui.md` + `accessibility.md`); the design
spec only names the bar:

- **Zero literal hex/px** in catalogue and application components — only `var(--token)`. A
  generated screen that hard-codes colour/type fails the `CE-BRAND-1` conformance gate (default ≥90%
  adherence, no critical violations) atomically (Build FR-029).
- **Contrast is pre-verified at the token level** (`color.md` computes it), so correct token
  composition yields an axe-passing surface by construction (`accessibility.md`).
- **Lighthouse 100 across all four categories** (Performance, Accessibility, Best-Practices, SEO) is
  the QA bar for the built Weave app. The token system serves this: variable fonts (one file per
  family), GPU-only motion, flat-base surfaces, and glass/glow reserved for key surfaces keep the
  performance and a11y scores at 100.

## Definition of done (token change)

- [ ] Value lives in exactly one taxonomy group; named by the convention (semantic, not literal).
- [ ] Both dark and light values are defined (or the token is explicitly theme-invariant).
- [ ] Any colour token has its computed contrast recorded in `color.md` and meets the relevant
      floor (text ≥4.5:1, UI/large ≥3:1 — see `accessibility.md`).
- [ ] `tokens.json` updated; `app.css` and the `CE-BRAND-1` projection regenerate cleanly and agree.
- [ ] No literal hex/px introduced in any consuming component.
- [ ] Version bumped per the semantics above; change is PROV-stamped at `CE-BRAND-1`.

## Cross-references (do not duplicate)

- [`color.md`](color.md) — the navy ramp, brand spectrum + gradients, semantic colours, and the 14
  BPMO kind palette with computed contrast and paired shapes.
- [`typography.md`](typography.md) — Geist Sans + Geist Mono, the type scale, mono usage.
- [`accessibility.md`](../accessibility.md) — WCAG 2.1 AA, contrast floors, focus, ARIA,
  `prefers-reduced-motion`. **This file does not restate WCAG numbers.**
- [`generative-ui.md`](../generative-ui.md) — the finite component catalogue and `CE-BRAND-1` token
  consumption / conformance gate that these tokens feed.

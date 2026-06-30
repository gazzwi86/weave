---
type: Coding Standard
title: Typography — Coding Standard
description: "The Weave type system: Geist Sans (UI) + Geist Mono (code/IDs/metrics/numbers) as variable fonts, the size/line-height/weight/tracking scale, the responsive (fluid) scale, mono-usage rules, and the accessibility floors (min sizes, contrast). Token-as-class consumption in the Vercel/Geist pattern."
tags: [standards, design, typography, fonts, frontend, accessibility]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/typography.md
---

# Typography

Weave's type system is built for restraint and density: a small, absolute set of decisions in the
Vercel/Geist tradition, where each type style bundles size + line-height + weight + tracking and is
consumed as a single token/class — not assembled ad hoc. This file owns the type scale;
[`tokens.md`](tokens.md) owns the taxonomy and pipeline; colour comes from [`color.md`](color.md).

## Font families

Two variable families, one file each. Variable fonts cover the whole weight range in a single
request — fewer network requests is a direct Lighthouse-100 lever (Performance + Best-Practices).

| Token | Stack | Use |
|---|---|---|
| `--font-sans` | `'Geist Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` | All UI text — headings, body, labels, buttons, nav |
| `--font-mono` | `'Geist Mono', 'SF Mono', Menlo, Consolas, monospace` | Code, IRIs/IDs, metrics, numbers, SPARQL, kbd |

- **Geist Sans** (Vercel) is the distinctive Swiss-minimal variable sans; **Geist Mono** is its
  monospace counterpart. Both are variable across Thin (100) → Black (900).
- Self-host the `.woff2` variable files (no third-party CDN — Best-Practices + privacy). Preload the
  two files; `font-display: swap` to avoid invisible-text (FOIT) blocking on first paint.
- Enable contextual/stylistic features where they aid legibility: `font-feature-settings`
  pragmatically; for `--font-mono`, enable `'zero'` (slashed zero) and `'ss01'` so IDs and metrics
  are unambiguous — this matches the prototype `.mono { font-feature-settings: 'zero','ss01' }`.
- The prototypes ship Inter + JetBrains Mono; the design system **upgrades to Geist** as the locked
  brand typeface. The fallback stacks keep the prototypes legible until the Geist files land.

## Weight scale

Variable axis, but the system uses a fixed, named subset — never arbitrary weights.

| Token | Weight | Use |
|---|---|---|
| `--font-weight-regular` | `400` | Body, default |
| `--font-weight-medium` | `500` | Labels, chips, emphasised body, nav |
| `--font-weight-semibold` | `600` | Buttons, table headers, card titles, subheads |
| `--font-weight-bold` | `700` | Section headings (h2/h3) |
| `--font-weight-display` | `300` | Oversized display only (light weight at large size reads premium, the x.ai display move) |

## Type scale

The scale bundles size + line-height + weight + tracking (the Geist token-as-class pattern). Base
body is `15px / 1.5` — slightly above the prototype's compact `13px` so body copy is comfortable on
the dark canvas. Sizes step on a ~1.2 (minor-third) ratio. Line-height tightens as size grows;
tracking goes slightly negative on large sizes (premium) and slightly positive on the smallest /
all-caps labels (legibility).

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `--text-display` | `56px / 1.05` | `300` (display) | `-0.02em` | Hero / brand-moment headline (often gradient-clipped, see `color.md`) |
| `--text-h1` | `36px / 1.1` | `700` | `-0.02em` | Page title |
| `--text-h2` | `28px / 1.2` | `700` | `-0.01em` | Major section |
| `--text-h3` | `22px / 1.3` | `600` | `-0.01em` | Subsection, card group title |
| `--text-h4` | `18px / 1.35` | `600` | `0` | Card title, panel header |
| `--text-body-lg` | `17px / 1.55` | `400` | `0` | Lead paragraph |
| `--text-body` | `15px / 1.5` | `400` | `0` | **Default body** |
| `--text-body-sm` | `13px / 1.5` | `400` | `0` | Secondary text, captions, dense tables |
| `--text-label` | `12px / 1.4` | `500` | `0.01em` | Form labels, metadata |
| `--text-caption` | `11px / 1.4` | `500` | `0.02em` | Chips, badges, footnotes |
| `--text-overline` | `11px / 1.3` | `600` (uppercase) | `0.08em` | All-caps section eyebrows / kbd hints |
| `--text-mono` | `13px / 1.5` | `400` | `0` | Inline code, IDs, metrics (Geist Mono) |
| `--text-mono-sm` | `12px / 1.5` | `400` | `0` | Dense mono — table cells of IDs, SPARQL |

Token shape in `tokens.json` is a DTCG `typography` composite per row (fontFamily + fontWeight +
fontSize + lineHeight + letterSpacing), so one alias carries the whole bundle into both CSS and
Tailwind utility classes.

## Responsive (fluid) scale

Headings scale fluidly between breakpoints with `clamp()` so they stay assertive on desktop without
overflowing at 320px (WCAG 1.4.10 reflow — see `accessibility.md`). Body sizes are **fixed** (never
fluid) so reading measure stays stable; only display/h1/h2 are fluid.

| Token | `clamp(min, fluid, max)` |
|---|---|
| `--text-display` | `clamp(34px, 6vw, 56px)` |
| `--text-h1` | `clamp(26px, 4vw, 36px)` |
| `--text-h2` | `clamp(22px, 3vw, 28px)` |

At the `--bp-md` breakpoint and below, the page shell drops to a single column and `--text-body`
stays `15px` (never below the 16px-equivalent comfort floor for sustained reading on the lead
column; `--text-body` at 15px with 1.5 line-height clears it for UI body).

## Mono usage — the rule

`--font-mono` (Geist Mono) is **mandatory** for anything where character ambiguity or alignment
matters; it is never a stylistic flourish:

- **IDs & IRIs** — node IDs, task IDs (`TASK-042`), tenant/workspace IDs, version hashes, IRIs.
- **Metrics & numbers** — KPI values, counts, deltas, durations, percentages in `KpiCard`,
  `DataTable` numeric columns, the graph node/edge counts.
- **Code & query** — inline code, SPARQL, Turtle, JSON, shell, and the syntax-highlighted blocks
  (the prototype `.tk-*` token classes).
- **Keyboard hints** — `Cmd+K`, `Esc`, shortcut chips in the command palette and tooltips.

Tabular figures (`font-variant-numeric: tabular-nums`) are on for any column or live metric so digits
align and a streaming value does not reflow. Slashed zero (`'zero'`) is on for all mono so `0`/`O`
never collide in an ID.

## Accessibility

These are floors; the WCAG thresholds themselves live in [`accessibility.md`](../accessibility.md).

- **Minimum size:** no UI text below `11px` (`--text-caption`/`--text-overline` are the floor, used
  only for chips/eyebrows). Body and any sustained-reading text is `--text-body` (15px) or larger.
- **Contrast (computed in `color.md`):** body text uses `--color-text-default` (`#E5EAF2`, ≥13:1 on
  every surface) — clears the 4.5:1 normal-text floor with wide margin. `--color-text-muted`
  (`#8A95A8`, ≥5.2:1) is safe for normal text. `--color-text-subtle` (`#5C6779`) is **large-text /
  non-text only** (≥3:1 on `bg`/`surface`, fails on overlays) — never body copy.
- **Large-text floor (3:1)** applies at `--text-h3` (22px) and above, or `--text-h4` (18px) when
  `--font-weight-bold`. Below that, the 4.5:1 floor applies — so `--text-body-sm`/`--text-label`/
  `--text-caption` must use `--color-text-default` or `--color-text-muted`, never `subtle`.
- **Zoom:** all sizes are `px` tokens but the root respects browser font-size; layout stays usable
  at 200% zoom with no clipping (WCAG 1.4.4).
- **Line length:** sustained body copy is capped at ~70ch measure for readability; dense table/mono
  content is exempt.
- **No text in images** for content; the wordmark is the only baked-in type and ships an
  `aria-label`.

## Token-as-class consumption

Components reference the type tokens, never literal `font-size`/`line-height` — this is what the
`CE-BRAND-1` conformance gate checks (zero hard-coded px; `generative-ui.md`). Tailwind maps each
bundle to a utility (`text-body`, `text-h1`, `font-mono`…); raw CSS reads
`font: var(--text-body)`-style composites. Catalogue components (`generative-ui.md`) consume these
the same way generated UI does.

## Definition of done (typography)

- [ ] Text uses a scale token (`--text-*`); no literal `font-size`/`line-height`/`letter-spacing`.
- [ ] Family is `--font-sans` or `--font-mono`; IDs/metrics/code/kbd use `--font-mono` with
      slashed-zero + tabular figures where numeric.
- [ ] Colour token chosen so the size's contrast floor is met (large-text vs normal-text per above).
- [ ] No UI text below 11px; sustained body ≥ 15px.
- [ ] Fluid headings clamp without overflow at 320px; usable at 200% zoom.
- [ ] Variable font files self-hosted, preloaded, `font-display: swap`.

## Cross-references (do not duplicate)

- [`tokens.md`](tokens.md) — type-token taxonomy, naming, DTCG `typography` composite, pipeline.
- [`color.md`](color.md) — the text colour ramp and its computed contrast on every surface.
- [`accessibility.md`](../accessibility.md) — the WCAG 2.1 AA contrast, reflow, and zoom floors this
  scale is designed against.
- [`generative-ui.md`](../generative-ui.md) — token-as-class consumption and the conformance gate.

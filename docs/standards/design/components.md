---
type: Coding Standard
title: Components — Coding Standard
description: "The visual and interaction layer for Weave's UI: the shell/interaction primitives this design system owns (button, input, card, badge, nav/tabs, modal, popover, toast, side-panel/inspector, FAB, and the first-class Cmd-K command palette) with per-component state tables, size variants, glass-vs-flat elevation usage, and focus rings — all expressed as design tokens. Aligns with (does not duplicate) the finite generative-ui.md catalogue, adding only the visual treatment of its AI-emitted data widgets and their streaming states."
tags: [standards, design, components, command-palette, frontend, accessibility]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/components.md
---

# Components

This file owns the **visual and interaction contract** for Weave's components: their states, sizes,
elevation, and focus treatment. It is dark-first and graph-native — flat-fast surfaces as the base,
glass and glow reserved for key surfaces (graph canvas, overlays, modals, the Cmd-K command palette)
and brand moments, so Lighthouse-100 and WCAG-AA hold.

Every value below is a **token reference**, never a literal. `--color-*` from [`color.md`](color.md),
type from [`typography.md`](typography.md), and `--space-*` / `--radius-*` / `--shadow-*` /
`--duration-*` / `--ease-*` / `--z-*` / `--ring-focus` from [`tokens.md`](tokens.md). Introducing a
raw hex/px here would fail the `CE-BRAND-1` conformance gate ([`generative-ui.md`](../generative-ui.md))
— "concrete" means an exhaustive token per state cell, not a literal.

## Two vocabularies — what this file owns vs what it references

Weave has two distinct component vocabularies. Keeping them separate is the whole point of this file.

1. **The finite generative-UI catalogue** — the AI-emitted **data widgets**: `KpiCard`, `LineChart` /
   `AreaChart`, `BarChart`, `RankedList`, `DataTable`, `ActivityFeed`, `PieChart` / `DonutChart`,
   `Heatmap`, `AlertBanner`. [`generative-ui.md`](../generative-ui.md) is the **sole owner** of that
   catalogue (its closed set, props contracts, intent→component mapping, RSC streaming). This file
   does **not** re-list or re-own them. It adds only the *visual treatment* on top — elevation, and
   the **visual tokens for the states generative-ui.md defines behaviourally** (see
   [Data-widget states](#data-widget-states-visual-layer-for-the-generative-ui-catalogue) below).
   Chart styling and the graph itself live in [`data-viz.md`](data-viz.md).
2. **Shell & interaction primitives** — *not* in that catalogue, owned **here**: button, input/select,
   card, badge/chip, nav/tabs, modal/dialog, popover/tooltip, toast, side-panel/inspector, FAB, and
   the **command palette**. These compose the application shell that hosts the catalogue widgets.

## Shared interaction rules

These hold for every interactive primitive below; the per-component tables note only deviations.

- **States are a closed set:** `default`, `hover`, `active` (pressed), `focus-visible`, `disabled`,
  plus `loading` / `selected` / `error` where the component supports them.
- **Focus is non-negotiable.** Every interactive element renders `--ring-focus` on `:focus-visible`.
  `--ring-focus` is the one always-on elevation primitive — it is an accessibility primitive
  (WCAG 2.4.7), exempt from the flat-base and reduced-motion rules. Never `outline: none` without it.
- **Target size** ≥ 24×24 CSS px (WCAG 2.5.8, see [`accessibility.md`](../accessibility.md)); the
  comfortable hit area uses `--space-*` padding even when the visual glyph is smaller.
- **Motion** uses `--duration-fast` + `--ease-standard` for hover/press echoes, `--duration-base` for
  enter/exit; only `transform`/`opacity` animate. Every transition has a `prefers-reduced-motion:
  reduce` no-op (cross-ref [`accessibility.md`](../accessibility.md) Motion row).
- **Glass vs flat:** the base is **flat** (`--color-surface` family, no blur). Glass — a translucent
  fill + `backdrop-filter` blur + `--shadow-overlay` — is permitted **only** on modal/dialog,
  popover, the command palette, and graph-canvas overlays. Cards, buttons, inputs, nav, badges, and
  toasts are flat.
- **Tokens only:** colour/type/space/radius from tokens; `aria-*` state mirrors visual state
  (`aria-pressed`, `aria-expanded`, `aria-selected`, `aria-disabled`, `aria-busy`).

## Button

Variants: `primary`, `secondary`, `ghost`, `danger`. Flat in all states (no glass).

| State | Surface / fill | Text | Border | Notes |
|---|---|---|---|---|
| default (primary) | `--color-accent-soft` fill, `--color-accent-primary` edge | `--color-text-default` | `--color-accent-primary` | `--radius-base`, `--text-body` weight `--font-weight-semibold` |
| hover (primary) | `--color-accent-soft` → raise via `--color-accent-hover` edge | `--color-text-default` | `--color-accent-hover` | `--duration-fast` |
| active/pressed | scale `0.98` (transform) | — | — | `--duration-instant` |
| focus-visible | unchanged fill | — | — | `--ring-focus` |
| disabled | `--color-surface` | `--color-text-subtle` | `--color-border` | `aria-disabled`, no pointer |
| loading | fill held | spinner + label | — | `aria-busy`, label stays for layout stability |
| secondary | `--color-surface` | `--color-text-default` | `--color-border-strong` | — |
| ghost | transparent → `--color-hover` on hover | `--color-text-muted` → `--color-text-default` | none | — |
| danger | `--color-danger` soft bg | `--color-danger` | `--color-danger` | confirm-destructive only |

Sizes: `sm` (`--space-2` y / `--space-3` x, `--text-body-sm`), `md` (`--space-3` / `--space-4`,
`--text-body`, default), `lg` (`--space-4` / `--space-5`, `--text-body-lg`). Icon-only buttons carry
an `aria-label` and keep the ≥24px target. The **primary CTA may take a `--gradient-accent` sheen**
as a brand moment — reserved, not the default button.

## Input, textarea, select

Flat. `--radius-sm`, `--color-surface` fill, `--text-body`.

| State | Border | Fill | Text | Notes |
|---|---|---|---|---|
| default | `--color-border` | `--color-surface` | `--color-text-default` | placeholder `--color-text-subtle` |
| hover | `--color-border-strong` | — | — | — |
| focus-visible | `--color-border-strong` | — | — | `--ring-focus`; label stays visible |
| disabled | `--color-border-soft` | `--color-bg` | `--color-text-subtle` | `aria-disabled` |
| error/invalid | `--color-danger` | — | — | `aria-invalid` + `aria-describedby` → message in `--color-danger` |

Every field has an associated visible `<label>` (cross-ref `accessibility.md`). Mono fields (IRIs,
IDs, SPARQL) use `--font-mono` per [`typography.md`](typography.md).

## Card / container

The default flat surface. `--color-surface`, `--color-border`, `--radius-base`, `--space-5` padding,
`--shadow-1` only when raised above a sibling. Interactive cards add `--color-hover` on hover and
`--ring-focus` on focus; a selected card uses `--color-raised-strong` + `--color-border-strong` (never
colour alone — pair with a check glyph or `aria-selected`). **Brand cards** (hero, empty-state) may use
`--radius-xl` and `--gradient-brand` — a brand moment, not a default.

## Badge / chip

`--radius-sm` (chip) / `--radius-full` (pill), `--text-caption`, `--space-1` inner gap. A **status
badge** uses the semantic soft-bg pairs from `color.md` (`--color-success`/`-warn`/`-danger`/`-info`
on their soft bg) and is **always icon + text**, never colour alone. A **kind badge** pairs the
`--color-kind-*` fill with its `--shape-kind-*` glyph and label (see `color.md`; satisfies SC 1.4.1).
Removable chips carry a labelled close button (`aria-label`).

## Navigation & tabs

Topnav (`--z-sticky`, `--color-raised`, `--shadow-1` on scroll) and subnav. Tabs use the prototype's
`role="tablist"`/`role="tab"`/`aria-selected` pattern (`accessibility.md`).

| State | Indicator | Text | Notes |
|---|---|---|---|
| default tab | none | `--color-text-muted` | — |
| hover | underline `--color-border-strong` | `--color-text-default` | `--duration-fast` |
| selected | underline `--color-accent-primary` | `--color-text-default` | `aria-selected`, `aria-current` |
| focus-visible | — | — | `--ring-focus` |

The active indicator slides with `transform` (`--duration-base`, `--ease-standard`); reduced-motion
snaps it.

## Modal / dialog

**Glass surface.** `--z-modal`, `--color-overlay` fill at translucency + `backdrop-filter` blur,
`--shadow-overlay`, `--radius-lg`, `--space-6` padding. A scrim (`--z-overlay`, dimmed) sits behind.

- Reveal: `fadeIn` scrim + `slideInPanel`/scale-in dialog over `--duration-slow` `--ease-out`;
  reduced-motion → instant.
- **Focus trap on open, restore to trigger on close, close on `Escape`** (cross-ref `accessibility.md`
  — trap + restore is mandatory, beyond the prototype's close-on-Escape baseline).
- Native `<dialog>` semantics preferred; title via `aria-labelledby`.

## Popover / tooltip

**Glass**, lighter than modal. `--z-overlay`+ (above content, below modal), `--color-overlay`,
`--shadow-overlay`, `--radius-base`. Tooltip text `--text-body-sm`; opens on hover **and** focus
(focus reveals what hover reveals — `accessibility.md`), `--duration-fast`. Tooltips are
non-interactive and `aria-describedby`-linked; popovers may trap focus if interactive.

## Toast / notification

**Flat** (not glass — it overlays content but must stay instantly legible). `--z-toast`,
`--color-raised`, `--shadow-overlay`, `--radius-base`. Severity uses the semantic soft-bg pairs +
icon + text. Streamed/async toasts announce via `aria-live="polite"`; action-blocking errors use
`role="alert"` (cross-ref `accessibility.md`). Enter `slideInPanel`, auto-dismiss is pausable on hover/focus.

## Side panel / inspector

The spotlight/detail surface (Graph Explorer side panel; the prototype `Inspector`). `--z-panel`,
`--color-surface`, `--shadow-panel` (left edge), `--space-5` padding, full-height. Slides in with
`slideInPanel` (`--duration-base`, `--ease-standard`); reduced-motion → instant. Fully
keyboard-navigable and ARIA-labelled (not subject to the canvas v1 exemption). Icon-only actions
(e.g. "Delete connection") carry `aria-label`. Honours the model-hiding contract: raw IRIs only under
an "Advanced / technical details" disclosure (Explorer E1-S3).

## Floating action button (FAB)

`--radius-full`, `--color-accent-soft` fill + `--color-accent-primary` edge, `--shadow-overlay`,
fixed within `--z-canvas-overlay` on the graph canvas. ≥44px target. May carry `--glow-brand` when it
is the primary canvas action (brand moment). `aria-label` mandatory (icon-only). Hover lifts via
`transform` only.

## Command palette (Cmd-K) — first-class surface

The command palette is a **first-class component**, not a modal variant. It is the keyboard-first
entry point to every action and to canvas search (Explorer E1-S4).

**Surface & elevation**

- `--z-command` — **above modals** (it can be summoned over any surface, including an open dialog).
- **Glass:** `--color-overlay` translucent fill + `backdrop-filter` blur + `--shadow-overlay`,
  `--radius-lg`, centred, max-width capped, `--space-5` padding.
- **Brand moment:** a `--gradient-accent` top edge / focus ring is the palette's signature accent —
  the one place the gradient meets a daily-driver surface. Reserved to the palette and CTA.
- Reveal: scale-in + `fadeIn` over `--duration-slow` `--ease-out`; **reduced-motion → instant** (no
  scale, opacity-only crossfade).

**Anatomy**

| Part | Treatment |
|---|---|
| input row | `--font-sans` `--text-body-lg`, no border (the palette edge is the frame), placeholder `--color-text-subtle` |
| result list | rows at `--text-body`; active row `--color-hover` fill + `--color-accent-primary` leading edge |
| group headers | `--text-overline` (all-caps eyebrow), `--color-text-muted` |
| kbd hints | `--font-mono` `--text-caption` chips (`Cmd+K`, `↵`, `Esc`) — mono per `typography.md` |
| icons | kind glyphs use `--shape-kind-*` (search results that are graph nodes), tinted `--color-kind-*` |
| empty / no-match | defined empty-state row, never blank |

**Behaviour & a11y**

- **Focus trap** on open, **restore** to the prior focus on close, **`Escape`** closes
  (`accessibility.md`).
- The `Cmd/Ctrl+K` binding `preventDefault`s **only when its surface (or the app) owns focus** — it
  never silently swallows the browser shortcut globally (Explorer E1-S2 / `accessibility.md`). The
  sidebar search field is the always-available fallback entry.
- Results region is `aria-live="polite"`; the input is a combobox (`role="combobox"`,
  `aria-expanded`, `aria-activedescendant` on the active row); arrow keys move the active row, `Enter`
  invokes.
- All actions are keyboard-achievable through it (Platform PRD §Accessibility).

## Data-widget states — visual layer for the generative-UI catalogue

This is the *only* thing this file adds to the generative-UI catalogue: a visual token for each state
that [`generative-ui.md`](../generative-ui.md) defines **behaviourally**. The catalogue, props, and
streaming transport stay owned there; chart interiors are styled in [`data-viz.md`](data-viz.md).

| Behavioural state (owned by generative-ui.md) | Visual treatment (owned here) |
|---|---|
| streaming header + skeleton (≤ default 1 s) | `shimmer` skeleton over `--color-raised`; header row `--text-overline` + `aria-busy`; reduced-motion → static `--color-raised` block (no shimmer) |
| offline (LLM 503) | inline `AlertBanner`-style row, `--color-danger` soft bg + icon + retry; prompt stays retryable; `role="alert"` |
| data source unavailable | `--color-warn` soft-bg tile + named reason + retry; never blank |
| stale data | `--color-text-muted` "stale" badge + timestamp (`--font-mono`); content dimmed to convey staleness, not hidden |
| budget-capped | partial widget rolled back; cap message in `--color-warn`; no partial render persists |
| footer data-source label | `--text-caption` `--color-text-muted`, mono contract id |

Each widget tile is a flat **card** (above): `--color-surface`, `--color-border`, `--radius-base`,
`--space-5`. Bento-grid placement and column span are layout concerns (sibling `layout-grid.md`).

## Definition of done (component)

- [ ] Every colour/type/space/radius/shadow/motion value is a `var(--token)`; **zero literal hex/px**
      (passes the `CE-BRAND-1` conformance gate, `generative-ui.md`).
- [ ] Full state table implemented: default / hover / active / `focus-visible` / disabled (+ loading /
      selected / error where applicable); `--ring-focus` on every focusable element.
- [ ] Glass + `--shadow-overlay` used **only** on modal, popover, command palette, canvas overlay;
      everything else flat.
- [ ] Meaning never colour-alone — status/kind/selected states pair an icon/glyph/label or ARIA
      (`accessibility.md`).
- [ ] Overlays (modal, command palette) trap + restore focus and close on `Escape`; no global shortcut
      capture; `Cmd+K` only `preventDefault`s when its surface owns focus.
- [ ] All motion is `transform`/`opacity` with a `prefers-reduced-motion` fallback.
- [ ] Catalogue data widgets are **not** redefined here — only their states are given visual tokens.
- [ ] `@axe-core/playwright` returns zero violations on the surface (`accessibility.md`).

## Cross-references (do not duplicate)

- [`generative-ui.md`](../generative-ui.md) — **owner** of the finite data-widget catalogue, props
  contracts, intent mapping, RSC streaming, and the `CE-BRAND-1` conformance gate. This file adds the
  visual layer only.
- [`data-viz.md`](data-viz.md) — graph/network aesthetics and chart-interior styling for those widgets.
- [`tokens.md`](tokens.md) — `--space-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--ease-*`,
  `--z-*`, `--ring-focus`.
- [`color.md`](color.md) — surface/text/accent/status/kind colours and `--shape-kind-*` glyphs.
- [`typography.md`](typography.md) — the `--text-*` scale, `--font-sans` / `--font-mono`, kbd-hint mono.
- [`accessibility.md`](../accessibility.md) — focus, target size, ARIA, focus-trap, `Cmd+K`
  no-global-capture, reduced-motion, axe gate. **WCAG numbers are not restated here.**

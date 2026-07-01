---
type: Coding Standard
title: Motion — Coding Standard
description: "Rich-but-disciplined motion system for Weave: how the duration/easing tokens map to micro-interactions, page/route transitions, and the signature animated living graph; the six named keyframe bodies (GPU-only transform/opacity); the Framer Motion mapping; and the mandatory per-animation prefers-reduced-motion fallbacks."
tags: [standards, design, motion, animation, frontend]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/motion.md
---

# Motion

Weave's motion is **rich but disciplined**. The product is alive — nodes settle, panels glide,
the graph breathes — but every animation is GPU-cheap, durations are drawn from a tiny fixed
scale, and the whole system collapses to a calm, instant baseline the moment a user asks for
less motion. Motion is a brand signal *and* a Lighthouse-100 / WCAG-AA constraint at the same
time; this file holds both in tension on purpose.

This file owns **application, not values**. The duration scale, the easing curves, the named
keyframe *contract*, and the focus ring all live in [`tokens.md`](tokens.md) (§motion, §shadow)
— that is the single source of truth and the scalars are not restated here. This file says
*which* token applies to *which* interaction, gives the **keyframe bodies**, the page/route and
micro-interaction patterns, the living-graph contract, the Framer Motion mapping, and the
**per-animation `prefers-reduced-motion` fallback**. WCAG numbers are not restated — they live in
[`accessibility.md`](../accessibility.md) (Motion row).

## Principles — rich but disciplined

1. **GPU-only.** Animate **`transform` and `opacity` only.** Never animate `width`, `height`,
   `top`/`left`, `box-shadow`, `background-position`, `filter`, or layout-triggering properties
   in a running animation — they force paint/layout on every frame and silently tank the
   Lighthouse performance score. Glow and gradient effects are achieved by transforming/fading a
   *pseudo-element or overlay*, never by animating the shadow or background itself (see
   "Keyframes" below — the Blushift `pulseGlow`/`shimmer` originals are re-specified to obey this).
2. **One small scale.** Every duration is `--duration-instant | -fast | -base | -slow`; every
   curve is one of the four `--ease-*` tokens. No ad-hoc `300ms ease`. If an interaction seems to
   need a value off the scale, it is the wrong scale choice, not a missing token.
3. **Purposeful, not decorative.** Motion shows causality (this opened *from* that), spatial
   continuity (the panel came *from* the right), or state change (this is now active). Motion
   that carries no meaning is removed.
4. **Flat-fast base, glow/glass reserved.** Most surfaces animate flat and fast (`--duration-fast`,
   opacity/transform). The expensive treatments — glow halos, glass blur, the living graph — are
   reserved for **key surfaces** (graph canvas, overlays, modals, Cmd-K command palette) and
   **brand moments**, so the base UI stays cheap (cross-ref `tokens.md` §shadow,
   [`color.md`](color.md) glow usage).
5. **Interruptible.** Enter/exit animations must be reversible mid-flight (no janky snap-back).
   The Framer Motion `AnimatePresence` + spring/tween model below is interruptible by default;
   CSS-only animations use short durations so an interruption is imperceptible.
6. **Reduced motion is a first-class branch, not an afterthought.** Every animated pattern below
   ships an explicit reduced-motion fallback. This is a hard gate (cross-ref
   [`accessibility.md`](../accessibility.md)).

## Duration & easing — usage map

The scalar values are canonical in [`tokens.md`](tokens.md) §motion. This is the **usage**
mapping (which token, which interaction, which curve) — do not re-table the millisecond values
elsewhere.

| Token (see tokens.md) | Paired easing | Applies to |
|---|---|---|
| `--duration-instant` | `--ease-standard` | active/pressed state echo, chip toggle confirm, focus-ring snap |
| `--duration-fast` | `--ease-standard` | hover, focus, button/badge state, tooltip, sub-nav tab switch |
| `--duration-base` | `--ease-out` (enter) / `--ease-in` (exit) | element enter/exit, side-panel slide, route transition, dropdown |
| `--duration-slow` | `--ease-out` | modal + command-palette reveal, hero/brand moment, first graph paint |

Direction rule for enter/exit: **`--ease-out` decelerates *into* rest** (entrances, reveals);
**`--ease-in` accelerates *out of* rest** (dismissals, exits); **`--ease-standard`** is the
symmetric in/out for reversible state (hover, the panel glide); **`--ease-linear`** is for
continuous/off-screen motion only (shimmer sweep, gradient drift) — never for a UI element a user
is watching arrive.

## Keyframes — the six named bodies (GPU-only)

`tokens.md` declares the closed keyframe contract by name; this file defines the bodies. All six
animate **only `transform`/`opacity`**. Each ships a reduced-motion fallback (see the dedicated
section). These live in `app.css` (emitted alongside the token custom properties).

```css
/* 1. fadeIn — generic element/page reveal */
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* 2. slideInPanel — side panel / inspector entering from the right edge */
@keyframes slideInPanel {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
}

/* 3. pulseGlow — "running"/active emphasis.
   Re-specified vs the Blushift box-shadow original to stay GPU-only:
   the glow is a ::after halo pseudo-element that scales + fades, not an animated shadow. */
@keyframes pulseGlow {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%      { opacity: 0;    transform: scale(1.6); }
}
/* the halo element carries the static colour via --glow-brand; only opacity/scale animate */

/* 4. shimmer — skeleton-loading sweep.
   Re-specified vs the Blushift background-position original: an oversized gradient overlay
   is translated across the skeleton, so only transform animates (no background-position). */
@keyframes shimmer {
  from { transform: translateX(-66%); }
  to   { transform: translateX(166%); }
}

/* 5. livingGraph — the signature breathing of the idle graph canvas (see below) */
@keyframes livingGraph {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(0, -2px, 0); }
}

/* 6. gradientDrift — slow brand-gradient motion on key surfaces.
   The gradient lives on an oversized pseudo-element that is translated, never re-positioned. */
@keyframes gradientDrift {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-25%, 0, 0); }
}
```

Pairings: `fadeIn`/`slideInPanel` use `--duration-base` `--ease-out`. The four continuous loops
sit *outside* the interactive four-step scale because they are ambient, not interactive — each has
its own named duration token in [`tokens.md`](tokens.md) §motion: `pulseGlow` runs
`--duration-pulse` `--ease-standard` infinite; `shimmer` runs `--duration-shimmer` `--ease-linear`
infinite; `livingGraph` runs `--duration-breathe` `--ease-standard` infinite (slow, subliminal);
`gradientDrift` runs `--duration-drift` `--ease-linear` infinite.

## Micro-interactions

Small, fast, flat — the texture of a product that feels quick (the Linear/Vercel reference).

| Interaction | Animation | Token |
|---|---|---|
| Button / badge hover | background + border crossfade | `--duration-fast` `--ease-standard` |
| Button press | `transform: scale(0.98)` echo, release back | `--duration-instant` `--ease-standard` |
| Focus ring appear | `--ring-focus` opacity in (the ring itself is always-on; only its reveal animates) | `--duration-instant` |
| Chip / toggle on | colour + `transform: scale(1)` from `0.94` | `--duration-fast` `--ease-out` |
| Tooltip / popover | `fadeIn` + 2px `translateY` rise | `--duration-fast` `--ease-out` |
| Dropdown / select menu | `fadeIn` + 4px `translateY`, origin top | `--duration-base` `--ease-out` |
| Tab (sub-nav) switch | active-indicator slides under the new tab (`transform: translateX`) | `--duration-fast` `--ease-standard` |
| Toast enter / exit | enter `translateY` up + fade (`--ease-out`); exit fade + down (`--ease-in`) | `--duration-base` |
| Skeleton loading | `shimmer` overlay | `--duration-shimmer` `--ease-linear` loop |

Hard rules: button targets never shift layout on hover (scale/opacity only); never animate a
spinner with a layout-affecting property; a hover effect must complete within `--duration-fast`
so rapid pointer movement does not feel laggy.

## Page & route transitions

The SPA is a single React app (Next.js App Router). Route changes use a **fast crossfade with a
small vertical rise**, not a heavy slide — speed reads as quality.

- **Default route transition:** outgoing view `fadeIn`-reverse (opacity → 0, `--ease-in`),
  incoming view `fadeIn` + 8px `translateY` rise (`--ease-out`), both at `--duration-base`. The
  prototype `.page-enter` (`fadeIn 180ms ease-out`) is the baseline; `--duration-base` (200ms) is
  the standard.
- **Persistent shell.** The app shell (topnav, sub-nav, docked panels — see
  [`layout-grid.md`](layout-grid.md)) does **not** animate on route change; only the `<main>`
  content region transitions. This keeps perceived navigation instant and avoids re-animating
  chrome.
- **Overlay surfaces** (modal, command palette) reveal at `--duration-slow` `--ease-out`:
  backdrop scrim `fadeIn`, dialog `fadeIn` + `transform: scale(0.98 → 1)` and a small
  `translateY`. The Cmd-K command palette — a first-class surface — uses exactly this, at
  `--z-command` (see `tokens.md` §zIndex). Exit is `--duration-base` `--ease-in`.
- **Side panel / inspector** enters with `slideInPanel` (`--duration-base` `--ease-standard`,
  matching the prototype `.panel-enter`), exits reversed. Shadow is the static `--shadow-panel`
  (not animated).

Implement route transitions with Framer Motion `AnimatePresence` `mode="wait"` wrapping the
routed content, so an interrupted navigation reverses cleanly rather than stacking.

## The animated living graph — signature moment

The graph canvas is *the* brand surface (the Weave mark is a node-graph). It renders on
**Cytoscape.js** (the real render tech; the static aesthetic — node glow, edge contrast, selected
spectrum halo — is owned by [`data-viz.md`](data-viz.md), not forked here). This file owns only
the **temporal contract**: how things move in time.

| Moment | Motion contract |
|---|---|
| **First paint / layout settle** | Nodes do not pop into place. The force layout (`cose`/`fcose`) runs a brief settle — nodes ease from a seeded position to their resting layout in the `--duration-slow` band (a few hundred ms), edges `fadeIn` once endpoints settle. One settle, then quiescent — never a perpetually-jittering simulation. |
| **Node / edge enter** (graph grows) | New node `fadeIn` + `transform: scale(0.6 → 1)` `--ease-out`; its edges draw in after it lands. New elements nudge neighbours via a short re-settle, not a full re-layout. |
| **Spotlight (node selected)** | Selected node lifts (`pulseGlow` halo on once + steady `--glow-brand`), 1-hop neighbourhood stays full-opacity, the rest of the graph fades to a dim tier (opacity only) over `--duration-base`. Side panel enters in parallel (`slideInPanel`). De-select reverses. |
| **Trace / impact highlight** | Edges on the traced path brighten (opacity step) and the path animates a directional flow (a translated dash overlay — `transform` only). Non-path elements dim. |
| **Idle "breathing"** | When the canvas is focused but idle, the whole graph runs `livingGraph` (a ~2px `translate3d` drift at `--duration-breathe`) — subliminal life, GPU-cheap, no layout. This is the "alive" brand signature; it is **off** under reduced motion. |

Performance guard: the living-graph drift and any continuous canvas motion must keep the canvas
on the compositor (transform-only). Cytoscape node positions are not recomputed per frame for the
idle drift — it is a CSS transform on the canvas/layer, not a physics tick. A running force
simulation only exists during the bounded settle, then stops.

## Framer Motion mapping

Framer Motion (`motion` / `framer-motion`) is the React animation layer; it reads the **same
tokens** so motion stays consistent with CSS-driven animation. Bridge the CSS custom properties
into JS rather than hard-coding durations.

```ts
// motion.ts — tokens bridged from CSS custom properties (single source of truth)
const css = (v: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export const duration = {
  instant: parseFloat(css("--duration-instant")) / 1000, // Framer wants seconds
  fast:    parseFloat(css("--duration-fast")) / 1000,
  base:    parseFloat(css("--duration-base")) / 1000,
  slow:    parseFloat(css("--duration-slow")) / 1000,
};

// --ease-out cubic-bezier(0.16, 1, 0.3, 1) mirrored as a Framer array
export const ease = {
  standard: [0.2, 0.8, 0.2, 1],
  out:      [0.16, 1, 0.3, 1],
  in:       [0.4, 0, 1, 1],
} as const;

export const fadeRise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit:    { opacity: 0, y: 4, transition: { duration: duration.base, ease: ease.in } },
};
```

Rules: prefer **`transform`/`opacity` Motion values** (`x`, `y`, `scale`, `opacity`) — never
animate `width`/`height`/`top`/`left` via Motion. Use `AnimatePresence` for enter/exit so exits
run. Springs are allowed for the panel and graph-element motion (physically natural,
interruptible); tween + the `ease` curves above for everything tied to the duration scale. Honour
reduced motion via the hook below — Framer's `useReducedMotion()` returns the same signal as the
CSS media query.

## prefers-reduced-motion — mandatory per-animation fallback

This is a **hard gate** (cross-ref [`accessibility.md`](../accessibility.md) Motion row — that
file owns the WCAG requirement; this file owns the concrete fallback for each pattern). Under
`@media (prefers-reduced-motion: reduce)`, **no animation conveys information by movement alone**;
every transition either becomes an instant state change or a sub-`--duration-fast` opacity
crossfade. State is always reachable without motion.

| Animation | Reduced-motion fallback |
|---|---|
| `fadeIn` / page & route transition | instant, or ≤`--duration-fast` opacity crossfade — no `translateY` |
| `slideInPanel` (panel/inspector) | panel appears in place (opacity only), no slide |
| Modal / command-palette reveal | opacity only, no scale/translate |
| `pulseGlow` (running/active) | static `--glow-brand` (or a static "active" badge) — no pulse |
| `shimmer` (skeleton) | static skeleton block, no sweep |
| Button press / chip / tab indicator | instant state change, no scale/slide |
| Toast enter/exit | opacity only |
| **Living graph idle drift** | **off** — graph holds still |
| **Graph layout settle** | **settle instantly to the final layout** — no animated force simulation (accessibility.md calls out force-layout animation explicitly) |
| Node/edge enter, spotlight dim, trace flow | state applies instantly (final opacity tiers, final highlight); **no** directional flow animation, **no** scale-in |
| Widget streaming transitions | content appears without motion; `aria-live` still announces (accessibility.md calls out streaming transitions explicitly) |

The single exception to "motion off" is `--ring-focus`: the focus ring is an accessibility
primitive and is always rendered (cross-ref `tokens.md` §shadow). Its reveal is instant under
reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* keep focus ring visible; living-graph drift and skeleton sweep are disabled by the rule above */
}
```

In React, gate Framer Motion and the Cytoscape idle drift on `useReducedMotion()` so the JS
animation layer matches the CSS media query — do not rely on the CSS reset alone for
JS-driven motion.

## Definition of done (motion / animated surface)

- [ ] Every interactive transition uses a `--duration-{instant,fast,base,slow}` + `--ease-*`
      token; every ambient loop uses its named duration (`--duration-pulse/shimmer/breathe/drift`)
      — no literal ms/bezier in component code.
- [ ] Only `transform`/`opacity` animate; no `box-shadow`/`background-position`/layout properties
      in any running animation (glow/gradient via transformed overlay).
- [ ] Enter uses `--ease-out`, exit uses `--ease-in`; continuous loops use `--ease-linear`.
- [ ] Every animated pattern has an explicit `prefers-reduced-motion` fallback (instant or
      opacity-only); information is never carried by movement alone.
- [ ] The graph layout settle, living-graph drift, and streaming transitions are disabled/instant
      under reduced motion (the cases `accessibility.md` names explicitly).
- [ ] Framer Motion reads bridged tokens and uses `useReducedMotion()`; `AnimatePresence` wraps
      enter/exit.
- [ ] Lighthouse Performance stays 100 — verify no animation introduces sustained paint/layout.

## Cross-references (do not duplicate)

- [`tokens.md`](tokens.md) — canonical duration/easing/shadow/glow/ring scalars and the keyframe
  name contract. This file does not restate the values.
- [`accessibility.md`](../accessibility.md) — the WCAG `prefers-reduced-motion` requirement and
  the axe gate. This file does not restate WCAG numbers.
- [`data-viz.md`](data-viz.md) — the static graph aesthetic (node glow, edge contrast, selected
  halo, legend) on Cytoscape.js. This file owns only the temporal contract.
- [`layout-grid.md`](layout-grid.md) — the app shell whose `<main>` region the route transition
  animates while the chrome stays still.
- [`generative-ui.md`](../generative-ui.md) — widget streaming states whose transitions honour
  reduced motion.

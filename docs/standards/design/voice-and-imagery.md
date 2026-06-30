---
type: Coding Standard
title: Voice & Imagery — Coding Standard
description: "Weave's house brand voice (and how it differs from the per-tenant CE VoiceRules mechanism), logo usage and clear-space/lockups from the Weave mark, gradient/glow and glass imagery direction, illustration and empty-state direction, and the node/edge motif as the central visual idea. Cross-refs CE-BRAND-1 for client-voice enforcement and color.md for gradient usage rules."
tags: [standards, design, brand, voice, imagery, logo, illustration, frontend]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/design/voice-and-imagery.md
---

# Voice & Imagery

This file owns the **brand expression** layer of the Weave design system: how Weave *sounds*
(its house voice), how the mark is used, and how imagery — the gradient, glow, illustration, and
empty-states — carries the dark-first, graph-native identity. The *values* (gradient defs, glow
tokens) and their **usage rules** live in [`color.md`](color.md) and [`tokens.md`](tokens.md);
this file adds the **narrative** — why the spectrum means what it means and how to wield it — not
a second copy of the rules.

The single visual idea everything threads back to: **the node/edge graph**. The Weave mark is a
"W" drawn as a node-graph in the brand spectrum on deep navy. Weave models a company *as a graph*
and renders it *as a graph* — so the motif is not decoration, it is the product's thesis.

## Two voices — Weave's house voice vs the client's CE VoiceRules

A critical distinction, because Weave is a platform that governs *other companies'* brand voice:

- **Weave's house voice** (this file) — how Weave's own product UI, docs, marketing, empty-states,
  and error copy read. Authored here; it is fixed Weave-brand content.
- **The client's voice** — enforced by the **Constitution Engine**, not by this file. A tenant
  uploads their styleguide; the CE stores **VoiceRules** as governed individuals, each with a
  human label and a *machine-evaluable assertion* (e.g. "use active voice", "max reading age 12"),
  exposed via `CE-BRAND-1` `GET /api/brand/voice-rules` (CE PRD E4-S2 / FR-024). The Build Engine
  checks generated text against the *tenant's* VoiceRules at the conformance gate (default ≥90%,
  Build FR-029). That mechanism is owned by the CE and described in
  [`generative-ui.md`](../generative-ui.md) — **this file does not restate it**.

In short: **Weave's voice is authored content; the client's voice is governed data.** Generated
*client* UI obeys the client's VoiceRules; Weave's *own* surfaces obey the house voice below.

## Weave's house voice

Weave sounds like a senior systems architect who is genuinely excited about the work and refuses
to waste your time. Premium, alive, precise — never hype, never cute.

| Principle | Do | Don't |
|---|---|---|
| **Precise over impressive** | "Weave found 3 policies with no owning capability." | "Weave's AI magically discovers hidden insights!" |
| **Active & direct** | "Model your business. Generate the app." | "Your business can be modelled by Weave." |
| **Confident, not loud** | State the capability plainly; let it land. | Exclamation marks, ALL-CAPS urgency, "revolutionary". |
| **AI as infrastructure, not a mascot** | "Weave generated the pipeline." | "Powered by AI!" / "Ask our AI assistant!" (2026 best practice buries the AI-as-feature framing — see research). |
| **Honest about state** | "Data source unavailable — retry." (matches the defined offline/stale states) | Hiding failure, blank screens, hallucinated confidence. |
| **Graph-native vocabulary** | nodes, edges, kinds, the graph, the model, trace, spotlight. | generic "items", "things", "stuff". |

- **Sentence case** everywhere — UI labels, buttons, headings, nav. Never Title Case or ALL-CAPS
  for emphasis (the only all-caps is the `--text-overline` eyebrow, a typographic device, not a
  shout — see [`typography.md`](typography.md)).
- **Numbers & IDs in mono.** Voice and type reinforce each other: counts, IDs, and metrics render
  in Geist Mono (`typography.md`), so the prose stays human and the data stays precise.
- **Error copy** names the cause and the next action, never blames the user, and matches the
  defined terminal states in `generative-ui.md` (offline / unavailable / budget-capped / stale).

## Logo usage

The Weave mark is the node-graph "W" + the "eave" wordmark in white, on deep navy.

### Lockups

| Lockup | Use |
|---|---|
| **Full** (node-W + "eave" wordmark) | Primary — marketing, app top-left, login, docs header |
| **Mark only** (node-W) | Favicon, app collapsed nav, avatar, loading state, social icon |
| **Wordmark only** ("Weave", Geist) | Inline in body text where the mark would be too heavy |

### Clear-space & sizing

- **Clear-space:** keep a margin of at least the **height of one node** of the mark on all sides;
  nothing (text, edge, other logo) intrudes.
- **Minimum size:** mark-only no smaller than `20px`; full lockup no smaller than `24px` tall (so
  the wordmark stays legible). Below that, use mark-only.
- **Background:** the mark lives on **deep navy** (`--color-bg` / `--color-surface`) — its native
  home. On light theme, use the adapted light-navy or a defined inverse lockup; never place the
  spectrum mark on a busy or mid-tone background where the node halos lose contrast.

### Do / don't

- **DO** keep the wordmark white (`#FFFFFF` is reserved for the wordmark and brand moments —
  `color.md`); keep the node-W in the full spectrum.
- **DON'T** recolour the mark to a single hue, stretch/skew it, add a drop-shadow beyond the
  defined `--glow-brand`, rotate it, or re-letter the wordmark in a non-Geist face.
- **DON'T** place the mark inside a coloured chip — it owns its own navy clear-space.

## Gradient, glow & glass imagery

The full **usage rules** (when the gradient may appear, glass reserved for canvas/overlays/modals/
Cmd-K, the DO/DON'T list, the `gradientDrift` reduced-motion fallback) are **owned by
[`color.md`](color.md)** ("Gradient & glow usage rules") and [`tokens.md`](tokens.md) (`--glow-brand`,
`shadow`). This section adds only the *brand narrative* — what the imagery is *saying*:

- **The spectrum is the living graph.** The seven stops (cyan→teal→magenta→purple→amber→lime→blue)
  are the colours of the node-W. When the gradient appears — hero, the mark, the active-node halo,
  the Cmd-K accent edge, the living-graph signature moment — it says *"this is the graph, alive."*
  That is why the gradient is an **event, not a texture** (`color.md`): a graph lights up at a
  moment of attention, it is not a constant wash.
- **Glow = focus / life.** A glow means *this node/surface is the live one right now*. It is the
  visual echo of a graph node activating. Reserve it for the moment of focus; a permanently glowing
  UI reads as noise and costs Lighthouse.
- **Glass = depth without colour.** Translucent layers on the deep navy separate overlays from the
  canvas without adding hue — used only where `color.md`/`tokens.md` permit (graph canvas overlays,
  modals, command palette). Flat-fast everywhere else.
- **The base canvas is calm.** Deep navy, off-white text, flat surfaces, generous whitespace
  (5–9 core elements, progressive disclosure — research §2). The vibrancy is *earned* by contrast
  with that calm; if everything glows, nothing does.

## Illustration & empty-states

Weave's product is abstract (ontologies, graphs, data) — illustration is **diagrammatic, not
decorative**. The house illustration language *is* the node/edge motif.

- **Style:** line + duotone on navy, built from the same 24px grid and node/edge motif as the
  icons ([`iconography.md`](iconography.md)). Nodes (filled, optionally haloed) joined by thin
  edges — a literal mini-graph — rather than stock characters or generic blob-art.
- **Empty-states** are a brand moment *and* a next action, never a dead end:
  - Show a quiet node/edge spot illustration (line, with at most one spectrum-haloed node as the
    focal point), a one-line plain-spoken explanation in house voice, and the **primary action**
    (e.g. "Model your first capability", "Run a SPARQL query").
  - Empty ≠ broken. The "no data yet" empty-state is distinct from the **defined
    failure/unavailable states** (`generative-ui.md`) — empty invites, failure explains + retries.
  - Reduced-motion: any animated empty-state (e.g. a gently drifting graph) honours
    `prefers-reduced-motion` with a static frame (`accessibility.md`, `tokens.md` keyframes).
- **Photography:** avoid. Weave is a systems product; literal office/people stock photography
  fights the abstract, graph-native identity. If a human dimension is needed, prefer abstract
  data/graph renders over stock photos.
- **Iconography in illustration** reuses the kind shapes (`color.md` / `iconography.md`) where a
  kind is being depicted, so an illustrated "process" is the same hexagon the user sees on the
  graph — the visual language is consistent from marketing to canvas.

## Do / don't (imagery summary)

- **DO** make the node/edge graph the recurring hero of every brand surface.
- **DO** let the navy breathe; reserve gradient/glow for moments of focus and brand.
- **DON'T** wash body content, cards, default buttons, or data-viz series in the brand gradient
  (kinds own the data-viz palette — `color.md`).
- **DON'T** use stock photography, mascots, or "AI sparkle" clichés.
- **DON'T** restate the gradient/glow *rules* here — they live in `color.md`/`tokens.md`; this
  file is the *why*, those are the *when*.

## Definition of done (voice & imagery)

- [ ] Copy is Weave house voice: sentence case, active, precise, AI-as-infrastructure; errors name
      cause + next action.
- [ ] *Client* generated text is checked against the tenant's **CE VoiceRules**, not this file
      (`generative-ui.md` / `CE-BRAND-1`).
- [ ] Logo uses an approved lockup, honours clear-space + minimum size, sits on navy, unaltered.
- [ ] Gradient/glow/glass usage obeys `color.md`/`tokens.md` rules (event-not-texture, reserved
      surfaces); no restated rules, no constant glow.
- [ ] Illustration/empty-states use the node/edge motif (line/duotone), in house voice, with a
      primary action; reduced-motion honoured; empty distinguished from failure.

## Cross-references (do not duplicate)

- [`color.md`](color.md) — the brand spectrum, gradient definitions, and the **gradient/glow
  usage rules** this file narrates but does not restate.
- [`tokens.md`](tokens.md) — `--glow-brand`, the `shadow`/glass tokens, the `gradientDrift`
  keyframe and its reduced-motion fallback.
- [`iconography.md`](iconography.md) — the node/edge motif construction and the kind shapes reused
  in illustration.
- [`typography.md`](typography.md) — sentence-case, the `--text-overline` all-caps device, mono
  for numbers/IDs.
- [`accessibility.md`](../accessibility.md) — `prefers-reduced-motion`, the defined
  offline/unavailable states copy obeys, the legend requirement.
- [`generative-ui.md`](../generative-ui.md) — the **CE VoiceRules** client-voice mechanism and the
  conformance gate; the defined terminal/empty states.
- [`design.md`](design.md) — the parent north-star and the compiled `DESIGN.md` agents consume.

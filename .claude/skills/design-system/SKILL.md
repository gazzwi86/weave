---
name: design-system
description: >-
  Establish a project's product design system for UI-bearing projects. Triggered from the /po
  flow when the project has a frontend (web app, site, or UI components). Gathers inspiration
  assets (logo, mood boards, reference links, optional prototype), researches current design
  trends, elicits the look-and-feel via MCQs, and generates docs/standards/design/ (parent
  DESIGN.md + children + DTCG tokens) consumed by the Architect, Engineer, and QA agents.
---

# design-system

Produce (or refine) the **product design system** for a UI-bearing project: a human-authored
source under `docs/standards/design/` that compiles to (a) **DTCG design-token JSON** served by the
brand-tokens contract (`CE-BRAND-1` / `GET /api/brand/tokens`) and (b) an agent-consumable
**`DESIGN.md`** (x.ai 9-section format). It is the single source of truth for colour, type, motion,
spacing, components, and data-viz — so generated and hand-written UI is consistent, on-brand,
accessible (WCAG 2.1 AA), and able to hit **Lighthouse 100**.

> **Reference implementation:** the Weave project's own `docs/standards/design/` is the canonical
> example of the structure and rigour this skill produces. Use it as the pattern.

**Model:** High tier for elicitation/synthesis; mid tier for file generation.

## When this runs

The Product Owner triggers this skill **only for UI-bearing projects**. During `/po`, the PO asks
the explicit question *"Does this project have a UI (web app, website, or UI components)?"* — on
**yes**, it runs **after the brief/PRD and before `/architect`**, so the design system exists before
any UI is specced or built. Skip entirely for backend-only / CLI / pipeline / agent-only projects.

## Inputs

1. The project brief + PRD (`docs/specs/weave/engines/<entity>.md01-brief`, `02-prd`) — product, audience, tone.
2. Any brand assets already in the repo (a `logo.*`, existing tokens, a prototype under `prototypes/`).
3. Inspiration assets **requested from the user** (see Step 1).

## Steps

### Step 1 — Gather inspiration & assets (ask the user)

Before designing anything, **ask the user to supply inputs** (HITL). Request, with simple options:

- **Brand assets** — a logo (drop a file in the repo or share a path), existing colours/fonts, any
  brand guidelines.
- **Inspiration** — links to **websites/products** they like, **mood boards**, screenshots, Dribbble/
  Behance refs, or a Figma. Ask *why* each is liked (vibe, colour, motion, density).
- **A prototype (suggest one)** — suggest the user create a quick visual prototype to react to:
  e.g. generate one on **claude.ai** (or a tool like v0/Figma) and
  share the link/screenshots. A concrete prototype to critique beats abstract preference questions.

If the user has nothing yet, offer to proceed from the logo + research + sensible defaults, and
refine later.

### Step 2 — Research

- Analyse the supplied assets: extract the **logo palette**, any existing tokens, the prototype's
  patterns. Note the product's emotional target (premium / playful / enterprise-calm / data-dense).
- Research **current (latest) design trends** relevant to the product class (e.g. SaaS dashboards,
  AI-native/agentic UI, data-viz, motion systems, accessible colour, variable fonts). Cite sources
  and name reference products to emulate (Linear, Vercel/Geist, x.ai, Stripe, Supabase, etc.).
- Reconcile any conflicting existing token sources into one intended system.

### Step 3 — Elicit the look-and-feel (MCQs + visual references)

Run focused **MCQ rounds**, each with **visual reference links** (so the user reacts to real
examples), covering at least:

- **Direction / aesthetic** (e.g. dark-first vibrant vs clean-light vs dual-mode), anchored to the
  logo and the inspiration the user gave.
- **Colour** — brand palette + how any categorical/entity colours reconcile (compute **contrast**;
  prefer OKLCH variants that pass ≥3:1 on the base; pair colour with **shape/icon** so meaning is
  never colour-alone — WCAG 1.4.1).
- **Typography** — typeface(s) (UI + mono), scale.
- **Motion** — richness vs performance (GPU-friendly, `prefers-reduced-motion` fallbacks) so the
  Lighthouse/WCAG gates hold.
- **Theme modes** — dark/light/dual.
- **Gates** — confirm the **Lighthouse target** (default 100 across all four categories) and **WCAG
  2.1 AA**.

Resolve lower-stakes items by sensible default; surface the genuine forks. Run hypotheticals before
asking, per the harness Laws.

### Step 4 — Generate the design system

Author `docs/standards/design/` (OKF Coding-Standard frontmatter on each file):

- `design.md` — **parent / north-star**, the x.ai 9-section `DESIGN.md` the agents consume; an index
  of the children; the "compiles to DESIGN.md + CE-BRAND-1 tokens" statement.
- `tokens.md` — DTCG token hub + the compile pipeline (→ CSS custom properties + `CE-BRAND-1` JSON);
  one source → dark/light via `prefers-color-scheme`.
- `color.md`, `typography.md`, `motion.md`, `components.md`, `layout-grid.md`, `iconography.md`,
  `data-viz.md`, `voice-and-imagery.md`.

**Cross-reference, do not duplicate:** `docs/standards/accessibility.md` (WCAG AA, contrast, ARIA,
reduced-motion) and `docs/standards/generative-ui.md` (finite component catalogue) where present.
Use the Weave `docs/standards/design/` as the structural reference.

### Step 5 — HITL review & refine

Deliver section-by-section; let the user refine palette/fonts/motion. Once approved, note that the
**Architect** (task-brief `design_tokens`), **Engineer** (builds against it), and **QA** (design
conformance + Lighthouse/WCAG gate) consume it, and that the foundation epic must wire the tokens +
Storybook before any feature UI.

## Output

- `docs/standards/design/*` (parent + children).
- A pointer added to the standards index so the harness agents discover it.
- The design system is now a hard input to UI implementation: hard-coded values where a token exists
  are a QA failure, the same as an axe violation.

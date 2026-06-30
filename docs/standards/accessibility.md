---
type: Coding Standard
title: Accessibility — Coding Standard
description: "WCAG 2.1 AA target, keyboard navigation, ARIA conventions, and the axe zero-violations CI gate for all Weave UI surfaces (hand-written and Build-generated)."
tags: [standards, accessibility, frontend]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/accessibility.md
---

# Accessibility Standards

Every Weave UI surface — the Platform Generative Dashboard, the Graph Explorer, the Build
Engine kanban/task-tree, settings, search, and **all UI emitted by the Build Engine** — targets
**WCAG 2.1 Level AA**. Accessibility is not a polish pass: it is a release gate. A pull request
that introduces an axe-core violation on a gated surface does not merge.

This standard gates generated code. The Build Engine's `layout_constraints` and conformance
check (FR-029, ≥90% vs `CE-BRAND-1`) inherit these rules; generated components that fail an
axe assertion are rejected at the generation gate, the same as a SAST or type-check failure.

These rules support the PRD accessibility sections:

- Platform PRD §Accessibility — prompt bar, notification centre, settings, Compliance/Audit:
  WCAG 2.1 AA; zero axe-core violations is a release gate; all primary dashboard actions
  (prompt submit, pin, refine, publish) keyboard-achievable.
- Graph Explorer PRD §Accessibility — side panel, search overlay, filter sidebar, comments:
  WCAG 2.1 AA, keyboard-navigable, ARIA-labelled; canvas interactions have keyboard
  equivalents; canvas must not trap keyboard focus.
- Build Engine PRD §Accessibility (FR-016) — kanban, task detail, spec editor: WCAG 2.1 AA;
  task-tree SVG nodes keyboard-navigable (Enter opens detail); zero-violations axe gate.

## Conformance target

| Requirement | Rule |
|---|---|
| Standard | WCAG 2.1 Level AA on all production UI surfaces |
| Contrast | Text and meaningful UI ≥ 4.5:1 (≥ 3:1 for large text ≥ 24px / 18.66px bold) |
| Reflow | Usable at 320 CSS px wide without horizontal scroll (WCAG 1.4.10) |
| Zoom | No loss of content/function at 200% browser zoom (WCAG 1.4.4) |
| Motion | Honour `prefers-reduced-motion`; force-layout animation and widget streaming transitions must respect it |
| Target size | Interactive targets ≥ 24×24 CSS px (WCAG 2.5.8) |

Colour is never the *only* carrier of meaning. The Graph Explorer node palette and the
task-tree state colours (Build FR-016) must each pair colour with a text label or shape in a
visible **legend** — the prototype already ships a `Legend` component
(`prototypes/weave-prototype/frontend/src/components/Legend.tsx`) and a token palette
(`prototypes/weave-prototype/frontend/src/styles/tokens.css`); generated UI reproduces that
pattern, it does not invent colour-only encodings.

## Keyboard navigation

Every interactive element is reachable and operable by keyboard alone. No mouse-only paths.

### General rules

- Logical tab order follows visual/reading order; never use positive `tabIndex`. Use `0` to
  make a non-native control focusable and `-1` only for programmatic focus targets.
- Visible focus indicator on every focusable element (WCAG 2.4.7) — never `outline: none`
  without a replacement focus ring meeting 3:1 contrast.
- Modals/overlays trap focus *while open* (focus moves in on open, returns to the trigger on
  close) and close on `Escape`. The prototype `NodeEditModal`/`OnboardingModal` close-on-Escape
  pattern (`onKeyDown={(e) => e.key === 'Escape' && onClose()}` in
  `prototypes/weave-prototype/frontend/src/components/CytoscapeGraph.tsx:471`) is the baseline;
  generated modals must additionally trap and restore focus.
- App shortcuts (Cmd+K prompt bar, Cmd/Ctrl+0 fit-to-screen) must `preventDefault` **only when
  their surface owns focus** — never silently swallow a browser shortcut globally (Graph
  Explorer PRD E1-S2 failure-mode AC).

### Graph canvas — pan/zoom keyboard equivalents

The force-directed canvas is the one surface that need not be fully screen-reader navigable in
v1 (Graph Explorer PRD §Accessibility), but it **must not trap keyboard focus** and **must
provide keyboard equivalents for every pointer interaction**.

| Pointer interaction | Required keyboard equivalent |
|---|---|
| Scroll / pinch zoom | `+` / `-` zoom in/out while canvas focused; `Cmd/Ctrl+0` fit-to-screen |
| Drag pan | Arrow keys pan the viewport while canvas focused |
| Click node (spotlight + side panel) | Tab into a node list / focus a node then `Enter` to spotlight and open the side panel |
| Mouse hover label reveal | Focus reveals the same label that hover reveals |

- The canvas container is a focusable region (`tabIndex={0}`) with a `role` and an
  `aria-label` describing the graph and its node/edge count.
- Tab must be able to *leave* the canvas (focus moves to the next surface element); the canvas
  may not capture Tab.
- The side panel, search overlay, and filter sidebar are fully keyboard-navigable and
  ARIA-labelled (not subject to the canvas v1 exemption).

### Task-tree SVG navigation (Build Engine)

The Build task-tree is an SVG dependency graph (Build PRD FR-016 / E4-S2):

- Each task node is a focusable element (`tabIndex={0}`, `role="button"` or `role="treeitem"`)
  reachable by Tab in dependency order.
- `Enter` (and `Space`) on a focused node opens the Task Detail panel — matching the PRD AC
  "nodes are keyboard-navigable (Enter opens detail)".
- Node state is conveyed by an accessible name, not colour alone (e.g.
  `aria-label="TASK-042 — blocked"`); the visible legend maps colour→state.
- Orphan/flagged nodes (missing-predecessor failure mode) carry the flag in their accessible
  name, not only a visual badge.

## ARIA conventions

- **Prefer native semantics.** Use `<button>`, `<a href>`, `<nav>`, `<table>`, `<dialog>`
  before reaching for ARIA. ARIA supplements native elements; it does not replace them.
- **Landmarks.** One `<main>` per view; navigation in `<nav>`; the prototype's
  `role="tablist"` / `role="tab"` / `aria-selected` tab pattern
  (`prototypes/weave-prototype/frontend/src/App.tsx:71-76`) is the canonical tab implementation.
- **Names.** Every control has an accessible name — visible `<label>` (associated via `for`/
  `id`), `aria-label`, or `aria-labelledby`. Icon-only buttons must carry an `aria-label`
  (prototype example: `aria-label="Delete connection"` in `Inspector.tsx:413`).
- **Live regions.** Streamed/async content announces via `aria-live`:
  - Generative Dashboard widget streaming → `aria-live="polite"` on the widget region so the
    streaming header / "data source unavailable" state / stale-data badge are announced.
    The LLM 503 offline state (Platform E1-S1) must be announced, not silent.
  - Toasts / notifications → `aria-live="polite"`; errors blocking an action → `role="alert"`.
- **State.** Reflect interactive state with the matching ARIA attribute: `aria-expanded`,
  `aria-selected`, `aria-pressed`, `aria-current`, `aria-busy` (during widget streaming),
  `aria-invalid` + `aria-describedby` on form fields with validation errors.
- **Hidden content.** Decorative SVG/icons get `aria-hidden="true"`; off-screen content uses
  `display:none`/`hidden`, never just visual offset, unless it is an intentional
  visually-hidden label utility.

## CI gate — axe zero violations (policy)

**Zero axe-core violations on gated surfaces is a hard release gate.** This is policy, not a
recommendation.

- **Scope (gated surfaces):** Platform — prompt bar, notification centre, settings,
  Compliance/Audit, dashboard widgets. Explorer — side panel, search overlay, filter sidebar,
  comments (the **non-canvas** UI; the force canvas itself is exempt from full SR-navigability
  in v1 but is still asserted for focus-trap and no-violation on its container chrome). Build —
  kanban, task detail, spec editor, task-tree.
- **Tooling:** `@axe-core/playwright` run inside the existing Playwright E2E suite
  (`prototypes/weave-prototype/frontend/playwright.config.ts` is the harness baseline), plus
  `vitest-axe` / `jest-axe` against rendered components in the unit layer
  (Testing-Library is already a dependency in the prototype `package.json`).
- **Assertion:** every gated surface runs `expect(results.violations).toEqual([])` at the
  `serious` + `critical` + `moderate` impact levels. A violation fails the job.
- **Lighthouse floor (secondary):** the prototype's Lighthouse CI accessibility floor of
  `minScore: 0.9` as an `error` assertion
  (`prototypes/weave-prototype/frontend/lighthouserc.json`) is retained as a coarse backstop;
  the axe per-surface assertion is the authoritative gate.

### Generated-UI enforcement

The Build Engine runs the same axe assertion against generated screens as part of its
generation gates (Build FR-029). A generated screen with an axe violation is treated like a
failed type-check: **atomic rollback, no partial commit.** The component catalogue in
`generative-ui.md` is pre-audited so that correct composition yields a passing surface by
construction; a catalogue component that ships an axe violation is a catalogue bug, fixed once,
upstream of all generated UI.

## Definition of done (per UI surface)

- [ ] Reachable and operable by keyboard alone; visible focus on every control.
- [ ] All interactive elements have accessible names; state reflected via ARIA.
- [ ] Contrast ≥ 4.5:1 (3:1 large); meaning never colour-only (legend present).
- [ ] Modals trap + restore focus and close on Escape; no global shortcut capture.
- [ ] Async/streaming regions announce via `aria-live`; errors via `role="alert"`.
- [ ] `prefers-reduced-motion` honoured.
- [ ] `@axe-core/playwright` returns zero violations on the surface in CI.

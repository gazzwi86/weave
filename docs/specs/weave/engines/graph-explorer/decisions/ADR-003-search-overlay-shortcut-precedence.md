---
type: Decision
title: "ADR-003: TASK-003 search-overlay Cmd/Ctrl+K takes precedence over the page-wide command palette"
description: "The explorer already ships a page-wide CommandPalette bound to Cmd/Ctrl+K. TASK-003 needs its own explorer-scoped Cmd/Ctrl+K for the client-side node search overlay (AC-5). Engineering decision: a capture-phase document keydown listener with stopPropagation() gives the explorer-scoped overlay precedence while the explorer is mounted, without modifying the pre-existing CommandPalette."
tags: [decision, adr, graph-explorer, keybindings, search, m1]
status: Accepted
timestamp: 2026-07-05T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer/decisions/ADR-003-search-overlay-shortcut-precedence.md
source: hand-authored
confirmed_by: gazzwi86
confirmed_on: 2026-07-05
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: graph-explorer
---

# ADR-003: TASK-003 search-overlay Cmd/Ctrl+K takes precedence over the page-wide command palette

**Scope:** [Graph Explorer](../../graph-explorer.md) TASK-003 (Node Spotlight + Search Overlay),
AC-5 (Cmd/Ctrl+K opens the client-side search overlay) only.

## Status

**Accepted — Engineer decision during TASK-003 implementation, no open trade-off requiring
human sign-off (see Alternatives below for why).**

## Context

The shell already ships a page-wide `CommandPalette` component bound to `Cmd/Ctrl+K` via a
bubble-phase `document` keydown listener (pre-existing, outside TASK-003's scope). TASK-003's
AC-5 requires the **same key combination** to open a second, explorer-scoped overlay: a
client-side-only node search (no CE-READ-1 call) that only makes sense while the explorer canvas
is mounted.

Registering a second bubble-phase listener for the same key would fire **both** overlays on every
keypress -- wrong for the user (two competing UIs) and untestable as a single deterministic
behaviour.

## Decision

`use-search-overlay.ts` registers its `Cmd/Ctrl+K` listener on `document` with `{ capture: true }`,
and calls `event.preventDefault()` + `event.stopPropagation()` before opening the overlay -- but
only when the shortcut condition matches (`isSearchShortcut`) and no text input currently has
focus (`isTextInputFocused`, so typing "k" in a real text field is never hijacked). Capture-phase
listeners run **before** bubble-phase listeners for the same event, so this listener observes the
keydown first and can stop it from ever reaching `CommandPalette`'s bubble-phase listener.

This means: **while the explorer is mounted, Cmd/Ctrl+K always opens the node search overlay, never
the page-wide command palette.** The page-wide palette is unaffected on every other route.

Verified by a dedicated unit test in `use-search-overlay.test.ts` ("stops the Cmd+K keydown from
bubbling to a page-wide listener") that attaches a spy bubble-phase listener on `document.body` and
asserts it is never invoked once the explorer-scoped hook is mounted; and exercised end-to-end in
`tests/e2e/explorer-node-spotlight.spec.ts`.

## Consequences

**Positive:** AC-5 ships without touching `CommandPalette` at all (Law 3 -- touch only what you
must); the precedence rule is a single, testable, local decision inside the explorer's own hook.

**Negative:** a future third Cmd/Ctrl+K consumer on the explorer route would need to coordinate
with this same capture-phase listener rather than each hook silently fighting over the shortcut --
if that need arises, promote this into a small shared "shortcut registry" rather than adding a
third ad-hoc capture listener.

## Alternatives considered

- **Modify `CommandPalette` to know about the explorer route and stay silent there** -- rejected:
  couples an unrelated, pre-existing, out-of-scope component to TASK-003's requirements, violating
  "touch only what you must" (Law 3 / CLAUDE.md working protocol #3).
- **Use a different shortcut for the search overlay (e.g. `/`)** -- rejected: AC-5 explicitly names
  `Cmd/Ctrl+K` (or the sidebar search icon) as the trigger; the icon remains available as the
  non-keyboard entry point regardless of this decision.
- **Bubble-phase listener with a mount-order assumption ("ours runs first because it mounts
  last")** -- rejected: listener order on the same phase is registration-order-dependent and not a
  contract worth relying on; capture-phase + explicit `stopPropagation()` is deterministic
  regardless of mount order.

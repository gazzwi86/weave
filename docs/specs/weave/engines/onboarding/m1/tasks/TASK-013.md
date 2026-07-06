---
type: Task
title: "Task: TASK-013 — Help Launcher & Contextual Help Panel"
description: "The persistent ? launcher in the platform header: search, tour launch (list when no
  area tour), show hints, training, keyboard shortcuts, What's new, change path, checklist
  restore, contact support — plus the 2–4-link contextual 'Help for this page' panel. Shift+? /
  Escape, fully keyboard-accessible."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-007
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-007", "TASK-008", "TASK-010", "TASK-012"]
unlocks: ["TASK-015"]
adr_refs: [ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E7-S1/E7-S2

## Story

As any user, I want help one click (or one keystroke) away on every screen — tours, hints,
training, shortcuts, what changed, my onboarding path, my checklist — so I never leave the
product to get unstuck.

## Scope Note

Frontend. The ? launcher mounts in the platform-owned header chrome (onboarding populates
content — the slot is Platform's). Entries: search across help + training content (TASK-012
index), "Take a tour" (current area's tour via TASK-007, or the available-tours list when the
area has none), "Show hints" (TASK-008 bulk restore), "Training library" / "What's new"
(TASK-012, unread dot via its hook), "Keyboard shortcuts", "Change my onboarding path"
(TASK-006 endpoint), "Show onboarding checklist" (TASK-010 restore), "Contact support" (new
tab). Contextual panel: 2–4 screen-relevant links from config, section hidden when none.
Keyboard: Shift+? (or ? outside a text field) opens, Escape closes.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-013-01 | WHEN the ? launcher opens on any screen THE SYSTEM SHALL offer: search, "Take a tour", "Show hints", "Training library", "Keyboard shortcuts", "What's new", "Contact support" (new tab), "Change my onboarding path", "Show onboarding checklist" (FR-026 + epic AC). |
| AC-013-02 | WHERE the current area has no tour, WHEN "Take a tour" is chosen THE SYSTEM SHALL show the list of available tours — no dead action (E7-S1 failure mode). |
| AC-013-03 | WHEN Shift+? (or ? outside a text field) is pressed THE SYSTEM SHALL open the launcher; WHEN Escape is pressed THE SYSTEM SHALL close it; the launcher SHALL be keyboard-accessible throughout (FR-027). |
| AC-013-04 | WHERE the launcher is open, WHEN the "Help for this page" panel renders THE SYSTEM SHALL show 2–4 links relevant to the active screen; IF none exist THEN THE SYSTEM SHALL hide the section — never an empty box (E7-S2). |
| AC-013-05 | WHEN any launcher entry is invoked THE SYSTEM SHALL resolve to a live surface (hints restored, library opened, path switcher shown, checklist restored) — no entry points at a missing surface (EPIC-007 epic AC). |
| AC-013-06 | WHEN the launcher renders THE SYSTEM SHALL pass the WCAG 2.1 AA zero-violations axe gate; all strings i18n; unread dot shows on the ? icon when What's-new has unread items. |

## API Contracts

Engine-internal only — the launcher aggregates surfaces shipped by TASK-006/007/008/010/012.
The header slot is platform chrome (coordination seam, not a contract).

## Diagram

architecture.md §Level 2 (overlay container). The launcher is composition; no new flow.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Launcher = composition over existing surfaces | Every entry resolves because its target task shipped first (DAG order) | EPIC-007 AC |
| Contextual links from config keyed by area | Same phase-tag machinery as tours; hidden-when-none | ADR-005/ADR-006 |
| `cmdk` (already installed) for the search palette | Reuse the installed dependency | Law A / ponytail rung 5 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Entry set renders; no-tour area ⇒ tours list; support opens new tab | AC-013-01/02 |
| Unit | Contextual panel: links for area; hidden when none | AC-013-04 |
| Unit | Shortcut handling: ? in text field does NOT open; Shift+? does | AC-013-03 |
| Integration | Each entry invokes its surface (hints restore call, checklist restore, path change) | AC-013-05 |
| E2E | `help-launcher.spec`: full keyboard journey + axe pass + unread dot | AC-013-03/06 |

## Dependencies

- **blocked_by**: TASK-007 (tours), TASK-008 (hints), TASK-010 (checklist restore),
  TASK-012 (training/What's new)
- **unlocks**: TASK-015 (launcher E2E in exit suite)

## Cost Estimate

**M** — composition + keyboard/a11y polish; the search palette reuses `cmdk`.

## DoR Checklist

- [ ] Platform header slot confirmed (where the ? icon mounts)
- [ ] All four blocking tasks merged (entries must resolve)
- [ ] Contextual-links config present for M1 screens (TASK-003 content)

## DoD Checklist

- [ ] All ACs pass; every entry resolves in integration
- [ ] Keyboard: open/close/navigate fully covered; text-field guard tested
- [ ] `ui_verify` passes; axe zero-violations
- [ ] Coverage ≥ 80%, mutation ≥ 60% on entry-resolution and shortcut logic

## Implementation Hints

The ?-outside-text-field guard: check `event.target` against
`input, textarea, [contenteditable]` — one predicate, unit-tested. Search unifies the TASK-012
content index with launcher entry names; `cmdk` gives listbox a11y for free. The unread dot is
TASK-012's `useWhatsNewUnread()` — do not duplicate cursor logic.

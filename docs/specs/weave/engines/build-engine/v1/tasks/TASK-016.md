---
type: Task
title: "Task: TASK-016 — Ontology Pin Upgrade (FR-012): CE-DIFF-1 Diff + Explicit Confirm"
description: "Pin-diff proxy endpoint (nodes+edges since the project's pinned CE version),
  explicit-confirmation upgrade endpoint with audit, and the settings-tab upgrade dialog
  wired to the M2 staleness indicator."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-014]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-016.md
---

# Task: TASK-016 — Ontology Pin Upgrade (FR-012): CE-DIFF-1 Diff + Explicit Confirm

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** technical architect
**I want** to see exactly what changed in the ontology since my project's pin, and upgrade
only on explicit confirmation
**So that** a pin upgrade is an informed decision, never a surprise re-grounding

> **FRs covered:** FR-012. Builds on FR-036 (M2 staleness indicator — the trigger surface)
> and `CE-DIFF-1` (nodes+edges diff between version IRIs).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/projects/{id}/pin-diff` is called, THE SYSTEM SHALL return the CE-DIFF-1 delta between `pinned_graph_version_iri` and the newest published version — the triple delta plus the response's ordered `versions: [{version_iri, breaking}]` span passed through verbatim (CE computes `breaking` at publish, covering function-signature AND shape/kind changes; Build never derives it) | `should return pin diff between pinned and latest version` |
| AC-2 | WHEN CE is unreachable during diff, THE SYSTEM SHALL return a named "diff unavailable" error — the UI renders it as such, never an empty diff (an empty diff reads as "no changes", a false-safe signal) | `should return diff unavailable not empty diff when CE unreachable` |
| AC-3 | WHEN `POST /api/projects/{id}/pin-upgrade` is called, THE SYSTEM SHALL require the request to echo the exact target `version_iri` shown in the diff (the explicit confirmation) and reject a mismatch with 409 | `should reject pin upgrade when confirmed version mismatches latest` |
| AC-4 | WHEN the upgrade commits, THE SYSTEM SHALL update `pinned_graph_version_iri`, write a PLAT-AUDIT-1 entry (old pin, new pin, principal), and the staleness indicator SHALL read current on next fetch | `should upgrade pin atomically with audit entry` |
| AC-5 | WHEN the upgrade dialog renders a diff containing `breaking: true` versions, THE SYSTEM SHALL visually flag the breaking span and require a second acknowledgement affordance before enabling confirm | `should require breaking acknowledgement before confirm` |
| AC-6 | WHEN a non-admin attempts the upgrade, THE SYSTEM SHALL 403 + audit (SETTINGS guard class) | covered by Role Guard suite (TASK-011); route registration asserted here |

## Implementation

### Pseudocode

```
GET /pin-diff (guard: read — any company (tenant) member):
    latest = ce_client.current_version()
    diff = ce_client.diff(project.pinned_graph_version_iri, latest)   # CE-DIFF-1
    return {from, to: latest, nodes, edges,
            versions: diff.versions}   # ordered [{version_iri, breaking}] — CE-DIFF-1
                                       # passthrough; same source as the M2 sdk_breaking_ack check
    on CEUnreachable -> 503 {error: "diff_unavailable"}               # AC-2

POST /pin-upgrade (guard: SETTINGS):
    if body.confirm_version_iri != ce_client.current_version(): raise 409   # AC-3
    async with tx:                                                     # AC-4
        repo.projects.update_pin(project_id, new=body.confirm_version_iri)
        emit_audit(pin_upgrade, old, new, ctx.principal_iri)           # in-tx outbox per
                                                                       # existing emitter pattern

UI (settings governance tab):
    StalenessBadge (existing FR-036 read) -> "Review upgrade" opens PinDiffDialog
    PinDiffDialog: node/edge delta list; breaking span -> AckCheckbox gates Confirm  # AC-5
    Confirm posts {confirm_version_iri: diff.to}
```

### API Contracts

`GET /api/projects/{id}/pin-diff` p95 ≤ 2 s (CE-bound; v1-delta §3) ·
`POST /api/projects/{id}/pin-upgrade` p95 ≤ 800 ms. Errors: 403, 404, 409 (confirm
mismatch), 503 (diff unavailable), 500. Consumes `CE-DIFF-1` + `CE-VERSION-1` via `ce_client`
only (ADR-001 — no raw SPARQL), `PLAT-AUDIT-1` emitter.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Pin Upgrade → ce_client path |
| Contract | `../../../../contracts.md` | §CE-DIFF-1 (breaking-span) | Diff shape + ordered `versions[].breaking` span — the one contracted breakingness source (`any(v.breaking)` in one call) |
| M2 staleness | `../../tech-spec/m2-delta.md` | §3.5 | The indicator this flow hangs off |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Confirmation = echo the target version IRI | AC-3 | Race-proof: a version published mid-review invalidates the confirm (409) instead of upgrading past what was reviewed |
| Empty diff is never synthesised from an error | AC-2 | Mirrors the staleness "unknown" honesty rule; CE outage must look like an outage |
| Breaking span needs a second acknowledgement | AC-5 | Same posture as the SDK `sdk_breaking_ack` gate (M2) — breaking is never one-click |
| Upgrade + audit in one transaction (outbox) | AC-4 | No pin change without its audit trail |

## Test Requirements

### Unit Tests (minimum 3)

- `should reject pin upgrade when confirmed version mismatches latest`
- `should return diff unavailable not empty diff when CE unreachable` (ce_client stub raising)
- `should require breaking acknowledgement before confirm` (dialog component test)

### Integration Tests (minimum 2)

- `should return pin diff between pinned and latest version` (CE stub with fixture versions)
- `should upgrade pin atomically with audit entry` (asserts row + audit stub payload — Law B)

### E2E Tests (Playwright, minimum 1)

- `should review diff and upgrade pin end to end` (staleness badge → dialog → confirm →
  badge reads current; `pinned_graph_version_iri` asserted server-side)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should return pin diff between pinned and latest version` |
| AC-2 | Unit | `should return diff unavailable not empty diff when CE unreachable` |
| AC-3 | Unit | `should reject pin upgrade when confirmed version mismatches latest` |
| AC-4 | Integration + E2E | `should upgrade pin atomically with audit entry` / E2E flow |
| AC-5 | Unit | `should require breaking acknowledgement before confirm` |
| AC-6 | Integration | Role Guard suite; route registration check |

## Dependencies

- **blocked_by:** [TASK-014] (settings tab + guard-wired router family)
- **unlocks:** []
- **External prerequisites:** `CE-DIFF-1` endpoint (live since CE M2); FR-036 staleness read
  (live since Build M2); `ce_client` (M1)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~14k input, ~7k output
- **Estimated cost:** ~$0.50 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. Playwright E2E with backend assertion)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `confirm` greppable in the pin-upgrade handler (invariants.md verify-by)
- [ ] Dialog passes ui_verify; Lighthouse targets hold on the settings route
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- `ce_client` already wraps CE-VERSION-1/CE-DIFF-1 from M1/M2 — this task adds routes + UI,
  not client methods (check before writing new ones).
- The diff payload can be large on a stale pin; render nodes/edges as virtualised lists and
  summarise counts up top — the p95 budget is on the API, the dialog must not choke on 1k rows.
- Reuse the M2 `sdk_breaking_ack` visual language for the breaking span flag (consistency:
  breaking looks the same everywhere).
- Audit emit uses the existing in-tx outbox pattern from the M1 emitter — do not emit
  post-commit fire-and-forget for a governance change.

## Design Requirements

### Page scaffolding + components

- Governance surface lives in the Settings tab; standard `PageHeader` + content scaffolding
  applies, not canvas-first chrome (`docs/design/visual-direction.md` §"Where canvas-first
  does NOT apply" — Audit trail/Settings/Build use standard page scaffolding).
- Entry point is the existing StalenessBadge (FR-036, M2 — read-only reference here, not
  respec'd); its "Review upgrade" action opens `PinDiffDialog` (this brief's own pseudocode,
  UI section).
- Diff view (`PinDiffDialog` body): list of added/removed/changed nodes+edges. Whether the
  structure is a native `<table>` or a labelled list is an implementation choice, not asserted
  here — Implementation Hints mandate virtualised rendering for ~1k rows, and a virtualised
  `<table>` fights that; the binding requirement is the a11y contract below, not a specific
  element. If a table structure is chosen, `DataTable` is the closest catalogued organism
  (`docs/design/v1-design-requirements.md` R13 names `DataTable` as a Storybook-first
  reusable component).
- Dialog chrome: `docs/standards/design/components.md` §Modal/dialog — glass surface,
  `--z-modal`, `--radius-lg`, `--space-6` padding, native `<dialog>` preferred, title via
  `aria-labelledby`.
- Breaking-span flag + AckCheckbox reuse the M2 `sdk_breaking_ack` visual language per this
  brief's own Implementation Hints and Design Decisions table (AC-5). No formal design-system
  token spec exists for this pattern yet (see GAPS) — the `--color-warn` mapping below is
  **advisory/inferred**, not a directly-cited requirement.
- Confirm button: `components.md` §Button — primary variant, loading state (`aria-busy` +
  spinner, label retained for layout stability) while confirm-in-progress. Whether a breaking
  upgrade should use the `danger` variant is a product call this brief does not make (`danger`
  is reserved to "confirm-destructive only" per `components.md`) — flagged **advisory**, not
  asserted.

### Tokens/type-scale bindings

- Diff row status colour: `--color-success` = added, `--color-danger` = removed,
  `--color-info` = changed (`docs/standards/design/color.md` §Semantic status colours
  supports this three-way split). Every row pairs colour with an icon + short text label
  ("+ Added" / "− Removed" / "~ Changed") — never colour alone (`color.md`: "Status is always
  paired with an icon and text ..., never colour alone").
- Breaking-span flag: `--color-warn` soft-bg treatment (advisory — see above), paired with an
  icon + "breaking" text label under the same never-colour-alone rule.
- Version IRIs (`from`, `to`/`diff.to`, and the echoed `confirm_version_iri`) render
  `--font-mono` with slashed-zero + tabular-nums (`docs/standards/design/typography.md`
  §Mono usage — IRIs are a named mandatory-mono case).
- Diff node/edge summary counts (Implementation Hints: "summarise counts up top") render
  `--font-mono` under the same rule (Metrics & numbers).
- Dialog title: `--text-h4` (card/panel header); row/body text: `--text-body-sm`
  (secondary/dense-table use) — both `typography.md` §Type scale.
- Spacing: dialog padding `--space-6`; row gap/padding drawn from the `--space-*` 8pt scale
  (`docs/standards/design/layout-grid.md` §Spacing system) — implementation picks the specific
  step; no literal px.
- Motion: dialog reveal `fadeIn` + `slideInPanel`/scale-in over `--duration-slow`/`--ease-out`,
  reduced-motion → instant (`docs/standards/design/components.md` §Modal/dialog;
  `docs/standards/design/motion.md` §Keyframes + §prefers-reduced-motion pairing table).
  Diff-loading skeleton uses `shimmer` over `--duration-shimmer`/`--ease-linear`, static
  fallback under reduced-motion (`motion.md` §Keyframes, §prefers-reduced-motion table).

### Required states

- **Diff loading:** skeleton/shimmer treatment, `aria-busy` on the diff region
  (`components.md` §Data-widget states — streaming/skeleton row).
- **No-diff (pin already latest):** genuine empty state, distinct from an error — `EmptyState`
  component (`v1-design-requirements.md` R13 names `EmptyState` as a Storybook-first
  component); copy should read as "up to date," not as a failure.
- **CE-DIFF-1 unavailable/error (AC-2):** rendered as a named error, never a blank/empty diff
  — `AlertBanner`-style treatment (`docs/standards/generative-ui.md` catalogue;
  `components.md` §Data-widget states "offline" pattern: `--color-danger` soft bg + icon +
  retry + `role="alert"`). The brief's own AC-2 text is itself the binding citation here:
  "never an empty diff (an empty diff reads as 'no changes', a false-safe signal)."
- **Confirm-in-progress:** `Button` loading state, `aria-busy`, label retained
  (`components.md` §Button).
- **Post-confirm success:** dialog closes; StalenessBadge reflects current on next fetch per
  AC-4 (existing FR-036 read, not respec'd here); optional `Toast` confirmation
  (`components.md` §Toast/notification, `aria-live="polite"`).

### Accessibility (beyond the global gate)

- Dialog: focus trap on open, focus restored to the "Review upgrade" trigger on close,
  `Escape` closes — mandatory (`components.md` §Modal/dialog; `docs/standards/accessibility.md`
  §Keyboard navigation).
- Diff region: accessible name (`aria-labelledby`/`aria-label`) identifying it as the ontology
  change list; if rendered as a list rather than a `<table>`, each row needs semantics that
  keyboard and screen-reader users can traverse row-by-row (`accessibility.md` §ARIA
  conventions — prefer native semantics).
- Colour-not-alone: every diff row status and the breaking flag carries an icon + text label,
  never colour alone (`color.md`; `accessibility.md` WCAG 1.4.1).
- Loading region: `aria-busy="true"` on the diff container while streaming (`accessibility.md`
  §ARIA conventions — live regions).
- Error state: `role="alert"` on the CE-unavailable message, an action-blocking error
  (`accessibility.md`).
- AckCheckbox: standard checkbox semantics with a programmatic label association; Confirm
  stays disabled (not merely visually inert) until checked, per AC-5. A native
  `<input type="checkbox">` + `<label>` pairing is the only checkbox primitive currently in
  scope (see GAPS — `components.md` has no dedicated Checkbox contract).
- Contrast: all text meets `typography.md`/`accessibility.md` floors — `--color-text-default`/
  `-muted` for body/labels, never `-subtle`/`-faint` on real text.
- Target size: dialog interactive elements (checkbox, buttons, any row affordances) hold the
  ≥24×24px target in both density modes (`docs/standards/design/layout-grid.md` §Density
  modes; `accessibility.md`).

### Responsive behaviour

- The diff list/table scrolls within its own container inside the dialog; the page body never
  gains horizontal scroll (`accessibility.md` §Reflow, WCAG 1.4.10 — no horizontal scroll at
  320px).
- Dialog uses the Inspector-class (~520px) or Reading-class container width, whichever the
  diff content needs (`layout-grid.md` §Container widths) — large diffs stay legible via the
  internal scroll, not by growing the dialog to the viewport.
- Usable at 200% zoom with no clipping (`accessibility.md` §Zoom, WCAG 1.4.4).

### JTBD success criteria

No `docs/design/jtbd.md` entry exists for this specific surface (ontology pin diff/upgrade) —
the closest is the generic "## Settings" entry, which covers members/roles/model
routing/budgets/notifications but does not mention governance/pin-diff. Per the
graceful-degradation rule, no success criteria are asserted from `jtbd.md` for this surface;
the acceptance lines above are grounded directly in this brief's own AC-1 through AC-6 and
Design Decisions table instead. **See GAPS.**

## GAPS

- **No `jtbd.md` entry** for the ontology pin-diff/upgrade surface — nearest is the generic
  "Settings" entry, which doesn't mention this job. Recommend a follow-up JTBD entry (job:
  "when the ontology has moved since my project's pin, I want to see exactly what changed and
  upgrade only when I've reviewed it, so a re-grounding is never a surprise").
- **No R-bundle in `v1-design-requirements.md`** (R1–R13) covers this Build-engine
  governance/pin-diff surface — bundles scope to Constitution, Explorer, Query, Audit,
  Settings-members/notifications, Build-request, or the Storybook foundation (R13); none
  address a diff/confirm governance flow. Recommend a follow-up R-bundle for Build-engine v1
  governance surfaces (this task plus any sibling pin/version-governance UI).
- **No formally-documented `sdk_breaking_ack` visual spec.** The breaking-span pattern this
  task must reuse (Implementation Hints: "Reuse the M2 `sdk_breaking_ack` visual language")
  has no entry in `docs/standards/design/*` — only this brief's own text and a raw, uncited
  mock (`docs/design/mocks/mock-v5-delta.html`: a plain "⚠ breaking:" line + disabled
  checkbox) exist as precedent. The `--color-warn` mapping above is therefore advisory, not
  directly cited. Recommend formalising a "breaking-change flag" pattern in `components.md`
  so it's consistent (and citable) everywhere it recurs, including here and the M2 SDK
  surface.
- **No dedicated Checkbox contract in `components.md`.** The AckCheckbox (AC-5) has no
  owning component spec beyond native checkbox semantics — flagged, not blocking, since
  native semantics satisfy the a11y gate on their own.
- **AC-3's 409 mismatch case has no UI-specified handling.** A version can publish mid-review,
  causing the confirm to 409. No error-state design is specified for this race — recommend
  the brief (or a follow-up amendment) specify the UI response (e.g. re-fetch the diff, show
  "the ontology changed again while you were reviewing") rather than leaving it for
  implementation to invent silently.
- **AC-6's non-admin visibility of "Review upgrade" is unspecified** — the brief specifies the
  403+audit guard on the POST route but not whether non-admins should see the trigger at all
  (hidden vs visible-then-403). Recommend clarifying at implementation or via a brief
  amendment; either is defensible but should be a stated decision, not an accident.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

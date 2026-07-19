# Issues

Single queue for the loop agents (LOOPS.md squads). One item lives in ONE place: merged work is
ticked in `docs/design/remediation-2-api-gaps.md`; open + unowned work is a pointer here. Sev
tags from the tracker (**H**/**M**/**L**/**S**mall). Source file given per item — read it for
full context before working anything.

## Design squad — UI refit remaining

Source for all: `docs/design/remediation-2-api-gaps.md` (mock reference:
`docs/design/mocks/refit-mock.html`; design tokens: `docs/standards/design/`).

- S3 · L · First-click dead-nav on icon rail — reproduce with a HUMAN hand once (repros on the
  static mock too → likely synthetic-click artifact); drop if unreproducible.
- H6 · M · /notifications renders the bell popover on an empty page — build the full-width
  notifications list page (mock carries the reference design).
- C5 · H · Explore label soup — raw RDF IRIs + orphaned sentences as node labels; drawer edge
  list shows raw IRIs. Overlaps V3b — coordinate, don't duplicate.
- C8 · M · Branding & standards page — data half seeded (#184: brand rules + standards docs);
  remaining: bind the page + conformance KPI (G14 endpoint) and match the mock's screen.
- C9 · L · "New instance" is a bare kind-select — apply the mock's authoring pattern.
- A2 · M · Busiest-entities list shows raw UUIDs/version strings — resolve to entity labels
  (A3's `friendlyEntity` last-segment trim landed #182; verify against live data, finish label
  resolution).
- A4 · — · Inference nav stays "soon" — future-phase reference screens live in the mock; no app
  work until those phases ship. Parking pointer only.
- B1 · L · Registry card task-counts/budget — copy humanized (#176); the DATA needs a
  registry-card summary field (backend) + binding.
- SE1 · L · Workspace description — copy humanized (#176); real fix needs a backend
  workspace-description field + General-panel binding.
- SE4 · M · Billing page is one sparse card — build usage-by-engine/user/project + budget burn
  vs cap (counts-only per FR-034/035); mock carries the reference design.
- SE5 · M · Operator console (Workspaces) bare — build to the signed-off operator screen in the
  mock.
- SE6 · M · "Profile & preferences" lands on workspace General — build the user-profile surface
  (mock carries one).
- G17 · S · Change-heatmap overlay needs a per-entity change-frequency source (extend
  CE-METRICS-1 or a viewer-safe audit-count read); toggle ships disabled with honest tooltip.
- G19 · UI-bug · Canvas node-clicks miss under overlay chrome — pointer-events/z-order fix in
  the ControlDock/legend components (tests currently route around it).
- V3-axe-fix · — · explorer-a11y-m2 panels violation blocks PR #152 — repro locally, fix,
  re-push #152.
- V3b / V3b-3 · — · Explore ask-bar wiring, KPI true-total, default filters + de-hairball
  (label-thinning landed; clustering stretch).
- V4 · — · Off-spec elements: remove injected page H1s; restyle kept extras (Build
  search/filter, "Generate a widget" CTA) to the mock's look.
- T5 · L · Consolidate Home → /dashboard (migrate role-home's next-action banner, capability
  cards, completeness map + re-anchor tour, THEN delist role-home). **Absorbs H7** (the nav
  item goes only as part of this migration — its "duplicate page" premise was stale).
- T6 · L · /build/ge-canvas-preview → project-scoped filtered Explore, linked from
  build-project nav.
- T7 · S · /events → disabled "coming soon" nav item (no live bare stub).
- T8 · M · Onboarding exercise-availability — backend exposes per-exercise availability on
  GET /api/onboarding/state so the client only checks available ones (kills the 403 noise).

## Refactor squad — tech debt / bloat

- BLOAT_REPORT.md (repo root) — 46 open items (dead organisms, EmptyState/DataTable/filter-bar
  consolidation, proxy-helper collapse, SPARQL-escape centralisation, CI stack-up composite
  action). Work the file directly; tick items there.
- T3 (tracker) · post-refit burn-down umbrella — folds into BLOAT_REPORT.md work.
- S6 follow-up (PR #175 note): search's `OPTIONAL { ?iri a ?kind }` fans out one row per
  rdf:type for multi-typed entities — dedupe in query or route.

## Bug squad

- A5 · S · Signing-key divergence hardening — `signing_key.py` can cache a key that diverges
  from the persisted secret across processes/worktrees sharing one LocalStack, silently
  corrupting chain signatures (the A1 banner's true cause). Fail loudly on mismatch. Source:
  `docs/design/remediation-2-api-gaps.md` (A5) + `.claude/state/escalations/A1-audit-chain-seed-blocker.md`.
- Pre-existing e2e bug (flagged in #183): `tests/e2e/global-search.spec.ts` presses ⌘K on
  /dashboard where the route guard hands it to PromptBar by design — the test asserts the wrong
  dialog on that route.

## Engine build — escalation blockers

All under `.claude/state/escalations/` — read the file before acting; several are
spec/architect decisions, not code fixes. (GE-TASK-001 is RESOLVED — `TASK-001-blocker.md` is
that same task's escalation; do not queue either.)

- CE-V1-TASK-014-blocker.md — TASK-015 dependency is real, not phantom; dispatch premise wrong.
- CE-V1-TASK-019-blocker.md — epic-close blocked: upstream stories missing, DoR unsatisfied.
- CE-V1-TASK-023-blocker.md — scope larger than briefed; AC-3/6/7 not actually live.
- ONB-V1-TASK-002-blocker.md — beacon/welcome-modal renderer (m1/TASK-008 machinery) missing.
- TASK-016-blocker.md — AC-3 E2E needs UI the brief says is out of scope.
- TASK-026-blocker.md — tenant member directory assumed by hints doesn't exist.
- TASK-031-blocker.md — AC-3 PROV-O history unreachable via CE-READ-1 (non-blocking descope;
  architect decision).
- TASK-G15-blocker.md — remediation tracker file divergence (likely stale post-#170; verify
  then close).

## Ops

- A1 residual · "Chain broken at entry 2" banner on the shared acme-corp demo persists until
  that tenant's `audit_entries` are reseeded — stale signatures from a one-time dev-session
  key divergence (seq 2–9). Code is fixed (#177 entries_checked + #184 seed regression test);
  this is purely an operational reseed on the shared stack (coordinate with whoever owns the
  running primary stack; a fresh seed verifies clean).

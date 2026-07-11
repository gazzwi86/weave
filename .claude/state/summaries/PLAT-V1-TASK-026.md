# Progress: PLAT-V1-TASK-026 — Storybook design-system foundation (atomic component library, R13) (EPIC-011, first task)

`weave-platform` EPIC-011 (the DESIGN-SYSTEM UPLIFT foundation). **PARALLEL LANE** worktree
`../weave-PLAT-V1-EPIC-011`, branch `feature/PLAT-V1-EPIC-011` (off origin/main). Frontend-only.
Built across 2 engineers (first overflowed "prompt too long" mid-GREEN; commit-first preserved work,
fresh finisher `plat026-eng2` continued). Coordinator-authored from receipt, pre-QA.

## Outcome

Engineer reports DONE — 7/7 ACs, 729/729 tests. QA pending: independently re-verify (esp. the 2 ESLint
rules actually FIRE on violations, and token-discipline is real).

## What shipped (9 commits, feature/PLAT-V1-EPIC-011)

- `f2314c5` test + `b7125ee` feat: 2 custom ESLint rules — `weave/token-conformance` (blocks raw
  hex/px/duration), `weave/dumb-component-imports` + `weave/app-layer-boundary` (import boundaries).
- `3c080bd` test: manifest-driven AC-1/AC-4 story-coverage tests.
- `271adac` atoms (Button/Card/Input state coverage) · `3c519ae` molecules (EntityRef, KindChip,
  PageHeader, CanvasLegend, KpiTile, AskBar, CanvasToolbar, EmptyState) · `e0ec1af` organisms (NavRail,
  SecondarySidebar, AppHeader, CommandBar, BellPanel, DataTable, InspectorPanel, GlassPanel) ·
  `d8b28f0` templates (CanvasPage, TablePage, FormDrawerPage, DashboardGrid).
- `95fe6d2` fix: drop invalid aria-selected from bare-div Card.
- `b438f07` test: AC-7 static Storybook prod-bundle-exclusion check.

## Per-AC

AC-1 (24 components tagged by layer, manifest test) ✓ · AC-2 (token-conformance lint blocks raw
hex/px/duration) ✓ · AC-3 (dumb-component import boundary: app/** only imports templates/pages) ✓ ·
AC-4 (1 story per state per theme, real-rendered via vitest browser-mode) ✓ · AC-5 (templates no
business-logic imports, data-only props) ✓ · AC-6 (app-layer boundary enforced) ✓ · AC-7 (Storybook
excluded from prod bundle — static test: storybook pkgs devDeps-only + zero .stories under app/**) ✓.

## Tests / gates (engineer-reported — QA re-verify)

729/729 tests (136 files, incl. browser-mode Storybook project rendering all stories as real DOM).
Lint 0 errors (2 pre-existing warnings unrelated). tsc clean. Coverage lines 93.3% (gate 80%). Complexity
0 errors, params ≤4 / nesting ≤2. Storybook prod build succeeds → gitignored storybook-static/.

## FLAGS FOR QA / coordinator

- **Token discrepancy (unresolved, doc-owner call — QUEUED for morning):** iconography.md uses hyphenated
  `--shape-kind-*`; shipped globals.css uses NO-HYPHEN (`--color-kind-businessdomain`). `--shape-kind-*`
  doesn't exist in globals.css in EITHER form. Engineer (the design-system authority) built KindChip against
  no-hyphen (matches shipped) + used local inline SVG glyphs as a shape stopgap (no shape token exists).
  Did NOT silently reconcile docs — correct. Resolution: iconography.md is stale → align to no-hyphen; the
  14-icon authoring is a separate design-owned task (PRD OQ-08). Coordinator-endorsed.
- **EPIC-011 milestone "v1" is UNDEFINED in the roadmap** (no phase-gate exit criteria) — this task BUILT
  fine (content complete), but its epic CLOSE has no gate to sign off against → PR HELD for morning +
  milestone-gate formalization queued. Building 026 was endorsed despite this (library needed regardless).

## PR / lane

Frontend-only, no migration. Per merge policy, EPIC-011 PR is HELD anyway (undefined milestone-gate).
EPIC-011 has more tasks (027-030 = the screen-level UI rollout that consumes this library). NOTE: TASK-027
+ TASK-030 have a flagged spec gap (workspace_admin role-slug + no role-slug convention) → the EPIC-011 lane
likely PARKS after 026 pending morning remediation, freeing a frontend lane slot.

## Dependencies unlocked (within EPIC-011)

TASK-027/028/029/030 (screen rollout) — but 027/030 blocked on the role-slug remediation.

## QA PASS after retry 1 (2026-07-11)

Round-1 QA (plat026-qa) FAILed on AC-2: `weave/token-conformance` ESLint rule didn't fire on the atoms
layer — its `files` glob targeted `components/atoms/**` (doesn't exist); real atoms live in `components/ui/**`.
The rule's own integration test passed against a FABRICATED path while real Button/Input/Badge could regress
unchecked (classic green-test-dead-enforcement). Retry-1 (`4ad0094` + `a373191`):
- **AC-2 glob fix:** added `ui` to the glob (`components/{atoms,molecules,organisms,templates,pages,ui}/**`);
  integration test retargeted to the real `components/ui/` path. **Adversarially re-verified:** injecting
  `#ff0000` into `components/ui/button.tsx` now ERRORS on real `npx eslint`, reverts silent.
- **Coverage:** CanvasToolbar (75→100%), CommandBar (77.77→100%), BellPanel (66.66→100%) via interaction tests.
- **globalIgnores:** added `storybook-static/**` + `coverage/**` (eslint.config.mjs:74-75).
Full suite 733/733 green, lint 0 errors, tsc clean. retry=1/3. **TASK-026 DONE.**

## Epic status — EPIC-011 stays OPEN + close-gate BLOCKED (morning)

TASK-026 (foundation) done; 027/028/029/030 (screen rollout) remain. **027 + 030 blocked** on the
workspace_admin role-slug remediation (queued). **EPIC-011 milestone "v1" is UNDEFINED in the roadmap** →
no phase-gate exit criteria → the epic CANNOT close/merge until the user defines the gate (fold EPIC-011/012
into v1.0 with exit criteria, or give "v1" its own gate). Building was endorsed; CLOSE is held for morning.

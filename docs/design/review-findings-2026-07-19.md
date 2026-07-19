---
type: Design
title: "Review findings — remaining work after the 2026-07-19 CI-wiring + cleanup session"
description: "Handoff doc: what shipped this session, what is still open, and severity/priority
  for each remaining item."
tags: [design, ci, handoff, tracking]
status: "Active — tracking doc for the human"
timestamp: 2026-07-19T00:00:00Z
resource: docs/design/review-findings-2026-07-19.md
source: 2026-07-19 CI-wiring + cleanup session
owner: gazzwi86
---

# Review findings — remaining work after the 2026-07-19 session (2026-07-19)

This is a handoff doc. It says what got done today, and lists everything still open so nothing
falls through the cracks. Written for a quick skim, not a deep read.

## Done today

- **#167** — fixed the flaky `axe-m2` CI test for real (not a retry hack). The bug was a race
  between the ControlDock accordion opening and the axe accessibility scan running before it
  finished. Fix: each tab now waits for its own `data-testid` (`control-dock-panel-<id>`) to be
  present before the scan runs.

- **#168** — wired two new CI jobs into `.github/workflows/ci.yml`, and both now **block merge**:
  - `visual` — Storybook + shell visual regression, 300 baseline screenshots (amd64). Baselines
    are regenerated via a `workflow_dispatch` input called `update_visual_baselines` (see the
    caveat in item 4 below — this is not a local `npm run` step).
  - `e2e-behavioural` — the `@behavioural` certification test suite, plus a scripted sweep of the
    backend log for any 5xx errors during the run.
  - Along the way, fixed one test that broke because a page moved: the natural-language authoring
    chat test still pointed at `/ce`, but the feature moved to `/ce/instances`.

- **#169** — docs, tracker, and memory housekeeping (no code changes).

- Both new jobs (`visual`, `e2e-behavioural`) were added to the **required status checks** on the
  `main` branch ruleset, so a PR cannot merge unless they pass.

- Branch and worktree cleanup: removed 37 already-merged local branches, deleted several merged
  remote branches, and removed one empty worktree (`d1-copy-sweep`).

## Remaining work

### 1. Harness rule file is out of date (governed fix — needs sign-off)

**Priority: low urgency, but should be fixed** — the documentation understates the repo's actual
protection, it does not overstate it.

`.claude/rules/git-safety.md` currently says the repo has "no server-side branch protection" and
that the local `check_force_push` hook is "the SOLE enforcement" against a force-push to `main`.

That statement is now **out of date**. As of this session, `main` has an active GitHub ruleset
(id `18363233`) that enforces, on the server side:

- pull requests are required (no direct pushes)
- linear history is required
- force-pushes are blocked (`non_fast_forward`)
- branch deletion is blocked
- required status checks must pass — now including the new `visual` and `e2e-behavioural` jobs

**Why this isn't a quick fix**: `git-safety.md` lives under `.claude/rules/`, which is
governed harness infrastructure (see `.claude/rules/harness-governance.md`). A normal
generation-tier agent (like the one writing this doc) is not allowed to edit it directly — the
change needs an advisor-model review plus explicit human approval before it can be committed.

This is already logged as **PROJ-015** in `.claude/state/qa-project-issues.md` — cross-reference
that entry for the full detail. Nothing to do urgently; just don't forget it's there.

### 2. Deferred features (each already has a full spec written)

These are sized as their own features/PRs, not quick fixes. Specs already exist — no elicitation
needed, just scheduling.

- **T5 — Home/Dashboard consolidation.** Fold the role-home page's tour, onboarding checklist,
  and "next action" banner into the canonical Dashboard page, so there's one home, not two.
  Spec: `docs/specs/features/T5_HOME_CONSOLIDATION_SPEC.md`.

- **T6 — Project-scoped Explorer.** Currently just a UI placeholder. Needs to become a real,
  filtered graph view scoped to a single project.
  Spec: `docs/specs/features/T6_PROJECT_EXPLORER_SPEC.md`.

- **Demo-data population.** Several dashboard/audit cards currently show empty "Not available
  yet" placeholders because there's no seeded demo data behind them. No spec written yet — this
  is a data-seeding task.

### 3. Minor UI polish (low priority, already tracked)

Small, cosmetic-leaning items — safe to batch into a future cleanup pass:

- A few graph edges on the canvas still show raw technical IRIs as their labels instead of
  human-readable names (examples seen: `rdf-syntax-ns#type`, `inDomain`).
- Double-check that the "Ask the model" search bar actually renders on the Explore canvas.
- Check that empty placeholder cards on the dashboard are still keyboard-focusable (accessibility
  check, not just a visual one).

### 4. Visual-regression baselines — operational caveat (read before touching visual tests)

The 300 visual-regression baseline screenshots were captured on the CI runner, which is **amd64**.

**Do not run `npm run test:visual:update` on an Apple-silicon (arm64) Mac to refresh them** —
the pixels will not match the amd64 baseline and the diff will look like a false failure.

To rebaseline correctly:

```bash
gh workflow run ci.yml --ref <branch> -f update_visual_baselines=true
```

Then download the resulting `visual-baselines` artifact and commit it. This flow is also written
up in the README's `## Testing` section — check there if this doc goes stale.

### 5. Branch/worktree residue — needs a human decision, not deleted

Left alone deliberately during this session's cleanup because their status is unclear:

- `feature/GE-EPIC-001` and `feature/GE-EPIC-001-task-002` (remote branches) — old epic work with
  no open pull request. Someone needs to confirm whether this work already landed another way
  before these are safe to delete.
- `fix/s1-header-overflow` — has an **open PR #171** (header command-bar overflow fix). Active,
  keep as-is, not cleanup residue.

### 6. Concurrent activity noticed during cleanup (flag for awareness)

While cleaning up branches and worktrees this session, two things showed up that this session did
not cause:

- `main` moved two commits ahead of PR #169 that this session didn't author: `feat(design): full
  refit mock` and `chore: session state + loop scaffolds + root lockfile`.
- Roughly 40 fresh `worktree-agent-*` worktrees appeared, all with timestamps only minutes old.

This looks like another background agent fleet or a second session working in the repo at the
same time. Nothing was broken by it, but it's worth Gareth reconciling what that other activity
was. **Because of this, further worktree/branch pruning was deliberately paused** this session —
better to leave possibly-in-flight work alone than to accidentally delete it.

---

## Appendix — full page-by-page click-through findings (2026-07-19)

Retained detail record from the click-through review of `main @ 20bad2b1`. All items are also tracked as checkboxes in `docs/design/remediation-2-api-gaps.md` (that tracker is the live work state; this appendix is the narrative detail). Severity: **H** = breaks use, **M** = clearly off, **L** = polish.

2026-07-19** — all items now live as checkboxes in `docs/design/remediation-2-api-gaps.md`
(§"2026-07-19 full-app review findings"); this file is the detail record only, do not tick boxes
here. Severity: **H** = breaks use/looks broken, **M** = clearly off, **L** = polish.

### Shell (cross-cutting)

- [ ] **S1 H · Horizontal overflow hides the header right cluster.** Whenever the secondary
  sidebar is open, the page is wider than the viewport: bell, help "?" and the avatar sit
  ~100–200px off-screen at 1568px width (invisible unless the user scrolls sideways). On pages
  without the secondary sidebar (e.g. 404) the header fits. Likely a fixed-width sum
  (rail + sidebar + min-width content) exceeding `100vw`. This also strands the notifications
  flyout and Help panel off-viewport (they anchor to the off-screen buttons).
- [ ] **S2 M · Stale breadcrumbs.** CE subpages all show "Constitution / Overview"
  (Types, Instances, Query, Glossary, Brand, Rules); Audit subpages stay "Audit trail /
  Dashboard"; Build subpages stay "Build / Registry". Settings/Billing updates correctly —
  pattern exists, other sections don't feed it.
- [ ] **S3 L · First-click dead-nav on the icon rail — likely test-tool artifact, verify
  then drop.** First click after a fresh page load only shows the tooltip; second click
  navigates. Reproduced identically on the static refit-mock (plain inline `onclick`), which
  points at the browser-automation synthetic click, not app code. Confirm with a human hand
  once; drop if unreproducible.
- [ ] **S4 M · Bottom-left rail "?" does nothing.** Clicking it produces no panel. The
  *header* "?" opens the (good) Help & learning panel — two help affordances, one dead.
- [ ] **S5 M · ⌘K palette: input not focused on open; typing goes nowhere.** Also shows
  "No results." before any query, and it is entity-search only while the header placeholder
  promises "Search, ask, or jump to…" (no page/action jump, no ask).
- [ ] **S6 H · Global search returns nothing for known entities.** `GET /api/search?q=order`
  → 200 with no results while the model contains "Customer order placed", "Order Fulfillment",
  glossary "Order". Suspect workspace scoping or the index not covering the demo workspace.
- [ ] **S7 L · Avatar initials render "SI" for user `admin`.** Initials derivation looks wrong
  (from "Signed in"?).

### Home / dashboard

- [ ] **H1 H · Widget tiles broken.** Header controls render as raw inline text
  "↑↓ Pin Unpin Publish" (both Pin *and* Unpin always visible); titles wrap badly
  ("Entities in / model").
- [ ] **H2 H · "Latest published version" shows the full URN**
  (`urn:weave:tenant:acme-corp:ws:2b00d676…:v0.1.6`) as display text — should be "v0.1.6" +
  workspace label.
- [ ] **H3 M · Stale-badge pill wraps over three lines** ("Stale — last updated / date / time").
- [ ] **H4 M · "Needs you" rows carry internal gap copy** — "pending, no cross-workspace gate
  feed yet (gap G12)". G12's endpoint landed; wire the feed and kill the placeholder copy.
- [ ] **H6 M · /notifications page renders the bell-panel popover floating on an empty page**
  — should be a full-width notifications list page (mock now carries the reference design).
- [ ] **H7 L · "What can Weave do for you?" sidebar item just re-shows the dashboard**
  (role-home folded in per T5) — drop or rename the item.
- [ ] Minor: `/api/onboarding/state` fetched 4× per dashboard load.

### Constitution

- [ ] **C1 H · Overview "Published version: No data yet" while Explore KPI + dashboard show
  v0.1.6.** Overview reads a different (wrong) source.
- [ ] **C2 L · Overview copy points to "the Versions screen" while nav "Versions" is marked
  soon** — copy/nav mismatch.
- [ ] **C3 M · Types page "Instances" column is all "—"** (counts not wired).
- [ ] **C4 M · Instances/Data: Ask panel overlaps the table** (Status column truncated).
- [ ] **C5 H · Explore label soup:** raw RDF IRIs (`…rdf-syntax-ns#type`) render as labels;
  orphaned description sentences float as node labels; detail-drawer edge list shows raw IRIs
  (`partOf → actor-280b2a0b…`) instead of resolved labels. (Overlaps V3b work.)
- [ ] **C6 M · Rules & policies carries an "M1 — this pass" phase pill** (violates the
  no-phase-pills rule) and the page is nearly bare — no rules list or designed empty state.
- [ ] **C7 M · Glossary Definition/Related columns all "—"** — demo seed has no definitions.
- [ ] **C8 M · Branding & standards effectively empty** — conformance "—" with "(G14)" dev
  copy; no seeded standards/brand rules (Hammerbarn content brief exists; seed should use it).
- [ ] **C9 L · "New instance" = bare "Choose a kind…" select on an empty page** vs the mock's
  authoring pattern.

### Audit trail

- [ ] **A1 H · "Chain broken at entry 2 · 0 entries checked"** on the demo workspace — the
  seeded audit chain fails verification, so every demo shows a red integrity banner.
- [ ] **A2 M · Busiest-entities list shows raw UUIDs/version strings**, not entity labels.
- [ ] **A3 M · Dashboard cards not wired to closed gaps** — "Model edits by kind" +
  Security/Governance/Budget/Reliability all "Not available yet" though the G5–G8 backend
  aggregations landed.
- [ ] A4 · Inference nav (Sentiment, Intent & urgency, Topics, Satisfaction, Quality & safety,
  Model metrics) is "soon" — now represented in the mock as future-phase reference screens.

### Build

- [ ] **B1 L · Registry card dev copy** — "task counts and budget need a registry-card summary
  field".
- [ ] **B2 M · Dashboard Roadmap panel dev copy** — "needs an epics endpoint" though G9/G10
  landed; wire it.
- [ ] **B3 M · Kanban default state reads as a filter failure** ("No tasks match this filter"
  + bare "Task tree" card) instead of a designed empty board.
- [ ] **B4 L · Decision log:** default tab shows "No decisions match this search" before any
  search; stray "Back to settings" link.
- [ ] **B5 L · Project settings "Review upgrade"** is a giant full-width button — off-design.

### Settings

- [ ] **SE1 L · General: Description placeholder is dev copy** ("the backend doesn't store a
  workspace description").
- [ ] **SE2 M · Members: every role select shows "Viewer" — including the seeded
  super-admin.** Role mapping/display bug.
- [ ] **SE3 L · Models & AI shows "(gap G13)" dev copy.**
- [ ] **SE4 M · Billing page is a single sparse card** — mock now carries the reference design
  (usage by engine/user/project, budget burn vs cap, counts-only note per FR-034/035).
- [ ] **SE5 M · Operator console (Workspaces) is bare** — plain cards + form vs the signed-off
  operator screen in the mock.
- [ ] **SE6 M · "Profile & preferences" in the user menu lands on workspace General** — no
  user-profile surface exists (mock now carries one).

### Cross-cutting content

- [ ] **D1 M · Internal tracker language leaks into product UI in ≥6 places** — "(gap G12)",
  "(G13)", "(G14)", "backend aggregation pending", "needs an epics endpoint", "registry-card
  summary field", "backend doesn't store…". One sweep to replace with human empty-state copy
  (the mock's error/empty patterns are the reference).
- [ ] **D2 M · Demo seed gaps undercut the demo:** no glossary definitions, no brand
  standards/rules, no build tasks/epics on the demo project, broken audit chain (A1), roles all
  Viewer (SE2). The Hammerbarn content brief (`docs/specs/weave/hammerbarn-content-brief.md`)
  should drive a fuller seed.

### Also verified working

Login via mock-OIDC; nav rail + all secondary navs; Explore node-click drawer, Overlays
(4 heatmaps, domain colouring, coverage gaps), Versions panel (0.1.1–0.1.6 + Compare); Types
table + filters; Instances list + kind chips + Ask commands; Query NL bar + SPARQL editor +
version selector; audit View logs filters + expandable rows + Verify chain/Export; Events
"soon" section; Members invite/table; Model routing tiers (Opus 4.8 / Sonnet 5); workspace
switcher w/ 3 workspaces; user menu; Help & learning panel (content-rich); practice-mode
banner + Reset demo. Backend health OK; no console errors on the pages visited.

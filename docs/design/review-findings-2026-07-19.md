---
type: Design
title: "Full app review — findings (2026-07-19)"
description: "Click-through review of main @ 20bad2b1: bugs, visual divergence, and dev-artifact
  copy found page-by-page. Kept separate from remediation-2-api-gaps.md (being worked in a
  parallel session) — fold in after approval."
tags: [design, review, findings, refit]
status: "Folded into tracker (docs/design/remediation-2-api-gaps.md) 2026-07-19 — work state lives there"
timestamp: 2026-07-19T00:00:00Z
resource: docs/design/review-findings-2026-07-19.md
source: browser click-through (Chrome MCP), main @ 20bad2b1, demo workspace
owner: gazzwi86
---

# Full app review — findings (2026-07-19)

Click-through of every page + key interactions, logged page-by-page. **FOLDED INTO TRACKER
2026-07-19** — all items now live as checkboxes in `docs/design/remediation-2-api-gaps.md`
(§"2026-07-19 full-app review findings"); this file is the detail record only, do not tick boxes
here. Severity: **H** = breaks use/looks broken, **M** = clearly off, **L** = polish.

## Shell (cross-cutting)

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

## Home / dashboard

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

## Constitution

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

## Audit trail

- [ ] **A1 H · "Chain broken at entry 2 · 0 entries checked"** on the demo workspace — the
  seeded audit chain fails verification, so every demo shows a red integrity banner.
- [ ] **A2 M · Busiest-entities list shows raw UUIDs/version strings**, not entity labels.
- [ ] **A3 M · Dashboard cards not wired to closed gaps** — "Model edits by kind" +
  Security/Governance/Budget/Reliability all "Not available yet" though the G5–G8 backend
  aggregations landed.
- [ ] A4 · Inference nav (Sentiment, Intent & urgency, Topics, Satisfaction, Quality & safety,
  Model metrics) is "soon" — now represented in the mock as future-phase reference screens.

## Build

- [ ] **B1 L · Registry card dev copy** — "task counts and budget need a registry-card summary
  field".
- [ ] **B2 M · Dashboard Roadmap panel dev copy** — "needs an epics endpoint" though G9/G10
  landed; wire it.
- [ ] **B3 M · Kanban default state reads as a filter failure** ("No tasks match this filter"
  + bare "Task tree" card) instead of a designed empty board.
- [ ] **B4 L · Decision log:** default tab shows "No decisions match this search" before any
  search; stray "Back to settings" link.
- [ ] **B5 L · Project settings "Review upgrade"** is a giant full-width button — off-design.

## Settings

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

## Cross-cutting content

- [ ] **D1 M · Internal tracker language leaks into product UI in ≥6 places** — "(gap G12)",
  "(G13)", "(G14)", "backend aggregation pending", "needs an epics endpoint", "registry-card
  summary field", "backend doesn't store…". One sweep to replace with human empty-state copy
  (the mock's error/empty patterns are the reference).
- [ ] **D2 M · Demo seed gaps undercut the demo:** no glossary definitions, no brand
  standards/rules, no build tasks/epics on the demo project, broken audit chain (A1), roles all
  Viewer (SE2). The Hammerbarn content brief (`docs/specs/weave/hammerbarn-content-brief.md`)
  should drive a fuller seed.

## Also verified working

Login via mock-OIDC; nav rail + all secondary navs; Explore node-click drawer, Overlays
(4 heatmaps, domain colouring, coverage gaps), Versions panel (0.1.1–0.1.6 + Compare); Types
table + filters; Instances list + kind chips + Ask commands; Query NL bar + SPARQL editor +
version selector; audit View logs filters + expandable rows + Verify chain/Export; Events
"soon" section; Members invite/table; Model routing tiers (Opus 4.8 / Sonnet 5); workspace
switcher w/ 3 workspaces; user menu; Help & learning panel (content-rich); practice-mode
banner + Reset demo. Backend health OK; no console errors on the pages visited.

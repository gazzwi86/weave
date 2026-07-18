---
title: T4 integration gate — mock-vs-app visual discrepancy matrix
type: report
status: in-progress
created: 2026-07-18
---

# T4 visual discrepancy matrix (mock `refit-mock.html` vs built app)

Method: authenticated app screens captured at 1440×900 in **dark mode** (the app's PRIMARY
theme per `globals.css`; an earlier light capture was a Playwright `prefers-color-scheme`
default, NOT a divergence). Mock screens captured from `docs/design/mocks/refit-mock.html`
via `switchSection()`. The mock is the authoritative design target.

Fidelity scale: 5 = faithfully realizes the mock's intent · 3 = recognizable, notable gaps ·
1 = unrecognizable.

## Home  (mock Home vs app `/dashboard`)  — FIDELITY ~2.5/5

The mock "Home" matches **role-home's** surface, not the current dashboard. Per the
coverage-reconciliation decision (`decision_home-and-canvas-surfaces`), dashboard becomes the
canonical Home and role-home's unique surface migrates in (tracked task **T5**). Most of this
gap is SUBSUMED by T5.

- [MAJOR] Mock KPI cards carry **live data** (Constitution 1,240 entities · v14; Build 2 projects ·
  1 gate · $234/$600; Audit 2,314 events · chain valid). App cards are **descriptive nav blurbs**
  ("The living knowledge graph…", "Explore the model →") with no metrics. → migrate role-home's
  data KPI cards (T5).
- [MAJOR] Mock "NEEDS YOU" shows real actionable items with Review/Decide/Fix **buttons**; app
  shows "pending — gap G12" placeholders with Browse/Fix **links** (cross-workspace gate feed gap
  G12, tracked).
- [MINOR] App has an **extra secondary sidebar** ("HOME / What can Weave do for you? / Notifications")
  the mock's Home doesn't; mock Home uses only the icon rail.
- [MINOR] App has a prominent "Generate a widget" button + raw principal URN chip; mock has a
  personalized "Welcome back, {name}" + workspace-context subtitle.
- [MINOR] App activity feed shows raw event types (member.invited, notification.dispatched · UUIDs);
  mock humanizes ("Model v14 published — 6 changes", "Marco Diaz joined as Modeller").

## Constitution  (mock Constitution [explore-first] vs app `/ce` overview + `/explorer`)  — see T6/routing

- [MAJOR] The mock's **Constitution screen opens on the Explore graph canvas** (rich BPMO graph,
  ControlDock, KPI strip, legend, ask-bar, minimap). The app's `/ce` landing is instead a **sparse
  "Constitution Engine" overview** — a large empty panel, an "Add entity / Select a kind…" dropdown,
  and a raw unstyled "Choose File" input. The graph canvas lives separately at `/explorer`.
  → Composition/routing divergence: either make `/ce` explore-first like the mock, or the mock's
  single Constitution screen maps to app's Explore. Needs a design/routing decision (see below).
- [MINOR] Sidebar group label "VOCABULARY & STANDARDS" (app) vs "STANDARDS" (mock); "Versions" is
  active under QUERY in the mock but shows "soon" (disabled) in the app.
- Graph-canvas fidelity (mock Constitution vs app `/explorer`): see council agent result below.

## Audit / Build / Operator / Settings

_Council agent results appended below as they complete._

## Headline

The app's **dark theme, shell chrome, nav rail, and component styling closely match the mock**
(theme divergence was a false alarm). The substantial remaining gaps are **page-composition /
information-hierarchy** level, not tokens: (1) Home is mid-migration to the canonical dashboard
(T5), and (2) Constitution is not explore-first and its overview landing is sparse/unpolished.
These are feature-scale, not quick token fixes.

## Per-page discrepancy matrix (per-screen design-QA agents, dark mode)

> NOTE: this is the mandated **visual discrepancy matrix**, a single-persona design-QA fidelity
> pass. It is NOT the multi-persona Law C council (product/security/architecture/engineering/QA/
> end-user/executive), which has NOT been run — that is premature until the visual gaps below close.

| Screen | Fidelity | Headline gap |
|---|---|---|
| Operator | 5/5 | Faithful — only cosmetic (button fill, label casing, glyphs) |
| Settings | 4/5 | Card-header styling (title-case vs uppercase eyebrow) + left-nav grouping drift |
| Audit | 3/5 | Flat borderless cards; 3 empty "Not available yet" cards; chart orientation swapped; no gradient bars |
| Build | 3/5 | Project cards miss budget-bar + stat-line ("Not available yet"); added filter row + card links not in mock |
| Home | 2/5 | Generic "Weave Dashboard" vs personalized live-data Home; off-spec "Generate a widget" CTA; descriptive cards vs data KPIs; raw event logs vs humanized feed (much SUBSUMED by T5 consolidation) |
| Constitution / Explore | 2/5 | **BLOCKER**: dense unreadable node hairball w/ raw machine-ID labels vs clean curated graph; placeholder KPI strip; injected "Graph Explorer" H1; **missing "Ask the model" bar**; legend uses raw type names |

**Aggregate visual-fidelity: 3.17/5, 2 blocker findings.** This is a design-fidelity average, not a
Law C persona-council score. IMPORTANT — separate the two failure classes: much of the low scoring
is **data/seed population** (empty "Not available yet" cards; the Explore "hairball" is the demo
workspace's real ~hundreds of entities rendered uncurated against a mock that hand-draws 8 curated
nodes — a curation-UX gap tied to T6, not a broken renderer), NOT UI-code breakage. Where the refit
was applied to shell/chrome it SUCCEEDED (Operator 5, Settings 4). What remains is (a) curation +
data population and (b) a few composition decisions.

## Themes across findings (what to remediate)

1. **Section-header styling (RECURRING, tractable)** — the mock uses small muted UPPERCASE
   letter-spaced eyebrow labels ("NEEDS YOU", "WORKSPACE", "MODEL EDITS BY KIND"); the app uses
   large title-case headings. Appears on Home, Audit, Build, Settings, Operator. One shared
   component/token fix lifts several screens.
2. **Empty "Not available yet" cards (DATA/SEED)** — Audit (3 cards), Build (project stats/budget),
   Home KPIs, Constitution KPI strip all render placeholders because the demo seed / pending metrics
   (CE-METRICS pending, gap G12, missing registry-card summary field) aren't populated. The mock
   shows populated target states. Partly a seed-data + metrics-wiring task, not pure UI.
3. **Explore graph canvas (BLOCKER, feature-scale)** — renders an uncurated hairball of hundreds of
   nodes with machine-ID labels instead of the mock's clean, curated, human-labelled BPMO graph;
   the "Ask the model" bar is missing; KPI strip is placeholder. Needs curation/limit, label
   resolution, ask-bar, populated KPIs. Related: T6 (project-scoped filtered Explore), G19 (canvas click).
4. **Off-spec additions** — "Generate a widget" CTA (Home), injected page H1s (Explore "Graph
   Explorer"), extra filter rows (Build), card action links (Build). Decide keep vs remove per screen.
5. **Constitution routing** — mock Constitution is explore-first; app `/ce` is a sparse overview.
   Design decision needed (make /ce explore-first, or accept the split).

Operator and Settings are close to target. Home is mostly the pending T5 consolidation. The heavy
lifts are Constitution/Explore (graph curation + ask-bar) and the recurring seed/empty-state gaps.

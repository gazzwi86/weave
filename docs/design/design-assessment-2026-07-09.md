---
type: Design
title: "Weave PoC — Design assessment (WS2, 2026-07-09)"
description: "Overnight UI/UX/CX assessment of the running PoC at localhost:3000: per-page JTBD
  review, findings ledger F-D01..F-D27 with severity + spec anchors, council synthesis, and the
  inputs to the visual-treatment mocks and v1 task requirements."
tags: [design, assessment, ws2, poc]
status: "Draft — findings pending user MCQ review (queued in morning-review doc)"
timestamp: 2026-07-09T00:00:00Z
resource: docs/design/design-assessment-2026-07-09.md
source: design assessment session (Fable orchestrator + research agents), live inspection via Chrome
owner: gazzwi86
---

# Weave PoC — Design assessment (2026-07-09)

Method: live click-through of every top-level area at `localhost:3000` (viewport 1212×980, dark
theme), computed-style probes, cross-checked against the approved IA proposal
(`docs/design/poc-ia-proposal.md`), the design system (`docs/standards/design/`), and the platform
spec navigation contract (`docs/specs/weave/engines/weave-platform.md` §Navigation). Competitor
pattern research ran in parallel (graph-canvas tools + enterprise app shells); its synthesis feeds
the mock-ups, not this ledger.

## What is genuinely good (keep, don't churn)

- **Left rail with grouped headers + phase pills** (`M2`, `v1.0`, `post-v1`) is implemented exactly
  as the IA proposal drew it — the single best thing in the current shell. Placeholder honesty
  ("Delivered in phase post-v1") communicates product shape well.
- **Token foundation is real**: body is Geist 15px/1.5, `#E5EAF2` on `#0A0E14` — the design-system
  values, not defaults. Kind colour dots are consistent across Overview, Types, and Explorer.
- **Audit chain-verified badge + export/verify actions** exist and match `PLAT-AUDIT-1`.
- **Versions lifecycle** (Published pill, mono version number) is present and sane.
- The guided authoring loop *works* end-to-end (constraint prompt → "Add an Actor called Finance
  Team" → created), even though its surface needs work (F-D12..14).

## Findings ledger

Severity: **Blocker** (breaks the demo story) · **Major** (undermines a primary JTBD) · **Minor**
(polish). Every item cites where it was seen and the spec/IA anchor it violates or advances.

### Shell & global

| ID | Severity | Finding |
|---|---|---|
| F-D01 | Major | No ⌘K command palette anywhere (verified: cmd+K no-op on `/ce`). IA proposal makes it first-class ("⌘K palette — nav + objects + actions"); design system reserves `--z-command` for it. |
| F-D02 | Major | No global search in the header at all — no entity search, no nav search. IA proposal puts search in the top bar; every reference product (Foundry, Linear, Notion) anchors on it. |
| F-D03 | Major | Notifications is a text label (no bell icon, no unread badge); clicking opens a full-height unstyled overlay reading "No notifications yet. Close". Help is a bare "?". Avatar menu absent — "Sign out" is a plain header link, no profile/role display. |
| F-D04 | Major | Workspace switcher renders the deprecated intra-tenant model: "acme-corp / Demo Workspace" + "E2E Sandbox" options, and Settings budget scope says "Company-wide (applies to every workspace)". Contradicts the binding tenancy ruling (workspace ≡ company/tenant; members see exactly one workspace, no switcher). |
| F-D05 | Minor | Logo mark is a tiny low-res image that renders fuzzy next to the wordmark; the brand's "W as node-graph in spectrum gradient" moment is nowhere in the app. |
| F-D06 | Minor | No breadcrumbs on any page (IA wireframe: `Workspace / Constitution / Instances`). Page context lives only in the rail highlight. |
| F-D07 | Major | Page titles under-spec: h1 renders 28px/600 vs the `--text-h1` token 36px/700. One step small + light across every page; hierarchy between title, card title, and body compresses. (User already flagged "font size up".) |
| F-D08 | Minor | Raw machine identity leaks everywhere a human name belongs: `urn:weave:principal:user:admin` as the dashboard hero and Versions author, full ISO timestamps (`2026-07-08T05:14:14.849716+00:00`) wrapping two lines in tables, created-entity link text is the full IRI. Pattern should be friendly label + mono ID as secondary metadata. |
| F-D09 | Minor | Button system inconsistent: full-width bright-cyan (Ask, Save), medium teal (Run, Set cap), outline (Export JSON), with no discernible primary/secondary rule; several forms use placeholder-only labels (Build description, budget "amount in USD", logs "event type"). |

### Home / Dashboard

| ID | Severity | Finding |
|---|---|---|
| F-D10 | Blocker | The dashboard — the first screen after login — is an empty centre-aligned hero: "Weave Dashboard", the raw principal URN in a box, two naked links, one placeholder card. `PLAT-EPIC-005` (workspace dashboard tiles + activity) is `done` in progress.json, but no tile grid renders. This is the demo's first impression. |

### Constitution — Instances / Data (`/ce`)

| ID | Severity | Finding |
|---|---|---|
| F-D11 | Blocker | There is **no instance browse/search/list surface at all**. The "Instances / Data" page is a chat transcript + an "Add entity" form. The CE brief's core JTBD — browse/search/author entities and relationships — has no browse half. The 7 seeded instances are invisible except via Explorer or SPARQL. |
| F-D12 | Major | The "chat" is a command parser (placeholder: "Add a Process called…") presented as NL chat. The persisted transcript shows the failure loop: "SDLC" → "I'm not sure what you mean" ×4. No suggestions, no template chips, no clear-history. FR-001 promises chat-first authoring; this reads as a broken chatbot. |
| F-D13 | Major | Authoring form: after picking a kind the picker disappears — nothing shows which kind you're authoring; "Performed by" (an object property to Actor) is a free-text box, not an entity picker; labels are correct but SHACL guidance (required markers aside) is invisible until submit. |
| F-D14 | Minor | Kind list (`/ce/types`): no `skos:definition` descriptions (planned v1 need), rows aren't links to a kind detail/shape view, and "1 properties" grammar. |

### Constitution — Explore (`/explorer`)

| ID | Severity | Finding |
|---|---|---|
| F-D15 | Blocker | Graph is unusable even at 7 nodes: layout clumps all nodes in the top-left corner overlapping the page title and search box; a stray node floats mid-canvas; "Reset layout" re-clumps rather than fit-to-viewport. No zoom/fit controls, no kind legend (IA wireframe specifies both). |
| F-D16 | Major | Edge labels render the full raw IRI `http://www.w3.org/1999/02/22-rdf-syntax-ns#type` in large text sprawling across the canvas. `rdf:type` edges should be hidden by default (kind is already colour+shape); named relationships should show their curie/label. |
| F-D17 | Major | No inspector side-panel on node select (IA wireframe: right inspector with properties/edges/PROV, edit entry). A phantom empty panel sits clipped at the bottom-right corner. Search box floats mid-canvas rather than in a toolbar. |

### Constitution — Query (`/ce/query`)

| ID | Severity | Finding |
|---|---|---|
| F-D18 | Blocker | NL "Ask" gives zero feedback: no loading state, no timeout, no error — 18s+ of dead air with the SPARQL editor never populated (backend NL provider likely absent, but the UI cannot say so). A demo cannot survive this. |
| F-D19 | Major | Results, when they render, are table-only; no graph-visual grounding of answers (the user's stated focus for this screen; IA wireframe: answers highlight grounded IRIs on the canvas). Version field is an unlabeled input containing "latest". "Explain this query"/"Run coverage gap report" sit at equal visual weight with Run. |

### Build (`/build`)

| ID | Severity | Finding |
|---|---|---|
| F-D20 | Major | Request form is missing the spec'd fields: grounding entities (from the graph) and target repo (`BE-EPIC-001`: "name, grounding entities, target repo"). Currently: one big unlabeled textarea, run-mode select, optional description. No link from a request to the project/provenance story. |

### Audit trail & Compliance

| ID | Severity | Finding |
|---|---|---|
| F-D21 | Major | Audit dashboard and Compliance page are text lists (headings + "ce_read_grounding: 1" lines, "▲ 1" inline trend glyphs) — the IA wireframe and the generative-ui catalogue (`KpiCard`, `BarChart`, area chart) specify tiles/charts. The bento-grid dashboard pattern exists in the design system and is unused. |
| F-D22 | Major | Logs table: ISO timestamps wrap to two lines, actor column is raw URNs, table clips horizontally with no scroll affordance (Engine/Event columns cut), filter is a single "event type" text input + Filter button (spec lists 7 filter dimensions), Export buttons wrap to a second row. |
| F-D23 | Minor | Route/IA incoherence: the Audit rail's "Compliance" item navigates to top-level `/compliance` while remaining visually inside the Audit section; spec's primary nav wants Compliance top-level, approved IA kept it under Audit trail. Pick one (queued as MCQ). |

### Settings

| ID | Severity | Finding |
|---|---|---|
| F-D24 | Major | Settings is missing Members (roles, `PLAT-EPIC-004` — done in backend) and Notification preferences (`PLAT-NOTIFY-1` — done in backend) sections entirely. Landing defaults to Models & AI rather than a settings overview or Members. |

### Marketing site

| ID | Severity | Finding |
|---|---|---|
| F-D25 | Blocker | "Log in" and "Get started" both route to `/login` → **404**. The public page's only CTAs are dead. (Dev session bypasses auth, so the app is reachable only by knowing `/dashboard`.) |
| F-D26 | Minor | Hero visual is a row of five coloured dots, not the graph-canvas screenshot the IA outline specifies; page lacks the feature grid / screenshot band / pricing sections of the approved outline. |
| F-D27 | Minor | `/ce` overview quick-links ("Explore Query Instances Audit trail") are bare text links in a row — fine, but they duplicate the rail and invite inconsistency. |

## Council synthesis (6 personas)

- **Product**: The thin loop exists (model → ask → build request → audit) but the *story* fails at
  three demo-critical beats: first screen (F-D10), "watch the graph" (F-D15), "ask in plain
  English" (F-D18). Fix those three and the demo lands even with everything else untouched.
- **Design/UX**: Foundation (tokens, rail, dark navy) is better than typical PoC; what's missing is
  the *system* — icons, buttons, page scaffolding (title/breadcrumb/actions), and the two signature
  surfaces (canvas, palette). Recommend a shared `PageHeader` + `Toolbar` + `EntityRef`
  (label + mono ID) primitives before per-page fixes; that converts 15 findings into 4 components.
- **End-user (analyst persona)**: "I cannot see my data." No instance list (F-D11), graph unusable
  (F-D15), query silent (F-D18) — every read path is blocked; the only working surface is *adding*
  data. Read paths must outrank authoring polish.
- **Engineering**: Most Majors are cheap: fit-to-view + hide rdf:type labels is a Cytoscape config
  change; timestamp/URN formatting is one utility; H1 size is one token class. The expensive items
  are the instance browser (new surface) and graph-grounded query results (new interaction).
- **Security/compliance**: Raw principal URNs on screen are an information-leak habit (F-D08);
  audit filters missing means the compliance officer JTBD (scoped review) fails (F-D22). Chain
  badge is good; keep it prominent.
- **Executive**: The workspace-switcher wording (F-D04) contradicts the tenancy decision we just
  locked — visible drift between spec and product in the first 5 seconds of a demo. Cheap fix,
  high credibility cost if left.

## Where this feeds next

- Visual-treatment mocks (3, medium restructure) — scratchpad HTML, published for morning review.
- JTBD document: `docs/design/jtbd.md`.
- Notifications role/types recommendation: `docs/design/notifications-recommendation.md`.
- v1 task requirements + `poc-ia-proposal.md`/design-standards updates: after morning MCQs
  (per plan, design remediation lands as task requirements, not inline edits).

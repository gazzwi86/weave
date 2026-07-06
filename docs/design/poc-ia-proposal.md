---
type: Design
title: "Weave PoC — Information Architecture & Navigation Proposal"
description: "IA + navigation proposal for the working PoC: primary/secondary nav, app shell, RBAC
  split, phase-placeholder inventory, marketing index outline, and Blushift/Foundry mapping."
tags: [design, ia, navigation, poc]
status: "Approved — human sign-off 2026-07-06 (all 6 decisions accepted: Home added as item #1;
  audit inference views = post-v1 placeholders + roadmap addition; Explorer-in-Constitution, keep
  Events/Audit labels, org-chart dropped, three demo logins — all accepted)"
timestamp: 2026-07-06T00:00:00Z
resource: docs/design/poc-ia-proposal.md
source: hand-authored (design agent)
owner: gazzwi86
---

# Weave PoC — IA & Navigation Proposal

Grounded in `docs/specs/weave/weave-spec.md` (§1.2/§1.3 M1 thin loop), the four engine specs,
`contracts.md` (contract IDs cited throughout), and the current build state in
`.claude/state/progress.json`. Visual/interaction reference: `prototypes/Blushift/` + Palantir
Foundry conventions.

**Status tags used below** — three states, because "not built" splits into two meaningfully
different cases:

| Tag | Meaning |
|---|---|
| `[built now]` | Backing epic/task is `done` in `progress.json` — surface binds to real capability |
| `[M1 — this pass]` | Backing M1 epic is in `backlog`; the PoC pass builds it (it is *not* a placeholder) |
| `[phase X placeholder]` | Roadmap phase M2 / v1.0 / post-v1 — render disabled with label **"Delivered in phase X"** |

**Build-state summary (from `progress.json`):** Platform shell, tenancy/workspaces, RBAC + agent
identity, global nav/search/dashboard shell, notifications, billing, and the immutable audit trail
(`PLAT-AUDIT-1`) are **done**. CE spine is **done** (SHACL pipeline, provenance/versions
`CE-DIFF-1`/`CE-VERSION-1`, `CE-READ-1`/`CE-WRITE-1`, perf spike). CE authoring surfaces, instance
population, ontology modelling, and NL/SPARQL query are **M1 backlog**. Explorer canvas is **M1
backlog** (10k-node spike done). Build engine loop is partially done headless (repo bootstrap,
safety-gate epics) but has **no UI surfaces until v1.0**. Events & Actions is **wholly post-v1**.

---

## 1. Primary navigation (top header)

The human's five-item list is **confirmed**, with two refinements and two naming notes — each
stated explicitly so nothing is silently discarded.

| # | Item | Purpose (one line) | Visible to |
|---|---|---|---|
| 1 | **Home** | Workspace dashboard — fixed CE-sourced tiles + activity (already built, PLAT-EPIC-005) | All tenant roles |
| 2 | **Constitution** | View, explore, author, and query the company graph (the MVP engine) | All tenant roles (write per role) |
| 3 | **Build** | Request and track generated applications | Workspace admin, enterprise architect, engineer, viewer (read) |
| 4 | **Events** | Create and monitor automations — *post-v1 placeholder* | Workspace admin, automation author |
| 5 | **Audit trail** | Metrics + queryable immutable log of every human/agent action (`PLAT-AUDIT-1`) | Workspace admin, compliance officer (full); others see own-activity subset |
| 6 | **Settings** | Workspace configuration: members, models, billing, notifications | Workspace admin (tenant scope); super-admin (provisioning scope) |

**Refinement 1 — add "Home".** The workspace dashboard shell is already built (PLAT-EPIC-005
`done`) and the spec *requires* it as the one thing every member lands on (FR-047: a member sees
their own workspace dashboard). Dropping it would discard working, spec-mandated capability.
Landing route after login = Home. If you want exactly five items, fold Home into the brand-mark
click target (Blushift does this) — my recommendation is to keep it visible.

**Refinement 2 — Explorer folds into Constitution for the PoC.** The platform spec's first-draft
IA lists Explorer as its own top-level area. The human's intent puts graph exploration inside
Constitution. These are compatible: `GE-CANVAS-1` is *by contract* an embeddable component, so the
PoC embeds it as **Constitution → Explore**. When Explorer M2 lands (full visual editing, overlays,
saved views), promote it to a top-level area — flagged now so the later promotion is not a surprise.

**Naming notes.** The platform spec calls the automation area **"Automate"** and houses audit
under a **"Compliance"** area. Recommendation: keep the human's labels (**Events**, **Audit
trail**) — they are more literal, and the PoC has no other Compliance content (conformance checks
are M2 `CE-BRAND-1`). Spec naming can be reconciled at M2.

---

## 2. Secondary (left) navigation — all sections

### 2.1 Constitution

Derived from the CE brief's Navigation section (`constitution-engine.md` §Navigation), re-grouped
and tagged. The persistent **chat authoring panel** (FR-001, CE-EPIC-011) is not a nav item — it is
a right-side panel available on every Constitution screen `[M1 — this pass]`.

| Group | Item | Status |
|---|---|---|
| Model | **Overview** — counts by kind, draft vs published, recent changes | `[M1 — this pass]` thin version via `CE-READ-1`; full model-health tiles `[M2 placeholder]` (`CE-METRICS-1`) |
| Model | **Explore** — force-directed canvas, drill-in, spotlight (`GE-CANVAS-1` embed) | `[M1 — this pass]` (GE-EPIC-001 backlog; spike done) |
| Model | **Ontology / Types** — 13 BPMO kinds + client extensions (`GET /api/ontology/types`) | `[M1 — this pass]` (CE-EPIC-001) |
| Model | **Instances / Data** — browse/search/author entities + relationships | `[M1 — this pass]` (CE-EPIC-002) |
| Query | **Query** — NL→SPARQL (`POST /api/query/nl`) + SELECT-only SPARQL editor | `[M1 — this pass]` (CE-EPIC-007) |
| Query | **Versions** — draft→published lifecycle, diff (`CE-DIFF-1`), PROV-O change log | `[built now]` API (CE-EPIC-009/010 done); UI this pass |
| Vocabulary & standards | **Glossary** (SKOS) | `[M2 placeholder]` (CE EPIC-003) |
| Vocabulary & standards | **Brand & voice** (`CE-BRAND-1`) | `[M2 placeholder]` (CE EPIC-004) |
| Vocabulary & standards | **Rules & policies** — tenant SHACL shapes, governance content | `[M2 placeholder]` (CE EPIC-005) |
| Vocabulary & standards | **Strategy & motivation** — mission/goals/drivers | `[M2 placeholder]` (CE EPIC-005 content area) |
| Tools | **Ingest** — document/EA-export/diagram import | `[v1.0 placeholder]` (CE EPIC-012) |
| Tools | **Reasoning** — OWL inference + inconsistency reports | `[post-v1 placeholder]` (CE EPIC-008, OQ-01-gated) |

The CE brief also lists an **Org chart** item. Recommendation: do not ship it as a nav item in the
PoC — it is not backed by any M1 epic; Actor instances are browsable under Instances. Revisit at
v1.0 with SSO/HR sync. (Stated so it is not silently dropped.)

### 2.2 Build

The M1 Build engine is a **headless dark-factory loop** (spec §1.3: PO requests one app → repo
bootstrap → generate → safety gates → write-back via `CE-WRITE-1` + `BE-ARTEFACT-1`). Its PM
*surfaces* (registry, kanban, dashboards) are explicitly **v1.0** (spec §1.4). So Build in the PoC
is one real action plus labelled placeholders:

| Item | Status |
|---|---|
| **Request application** — form: name, grounding entities, target repo; kicks off the M1 loop | `[M1 — this pass]` (BE-EPIC-001 backlog; repo bootstrap BE-TASK-010 done) |
| **Projects** — registry of generated projects + provenance/staleness (`BE-ARTEFACT-1`, `CE-VERSION-1` lag) | `[v1.0 placeholder]` (Build E2) |
| **Dashboard** — build health, gate pass rates | `[v1.0 placeholder]` (Build E3) |
| **Kanban** — task board per project | `[v1.0 placeholder]` (Build E4) |
| **Task briefs & decisions** — task detail + decision log | `[v1.0 placeholder]` (Build E5/E7) |

### 2.3 Events

Whole engine is post-v1 (spec §1.1 row 5). Every item renders as a placeholder; the section
exists in nav to communicate the product shape.

| Item | Status |
|---|---|
| **Automations** — create event→action rules (simple + agentic tiers, `EA-AUTOMATION-1`) | `[post-v1 placeholder]` |
| **Triggers** — graph-change (`CE-EVENT-1`), schedule, webhook | `[post-v1 placeholder]` (`CE-EVENT-1` itself is M2-beta) |
| **Runs** — execution history, per-run metering (`PLAT-BILLING-1`) | `[post-v1 placeholder]` |

### 2.4 Audit trail

Backed by `PLAT-AUDIT-1` — **done** (append-only, hash-chained, query + export). The two primary
items are real; the inference views are **net-new intent with no spec anchor** (see conflict note).

| Item | Status |
|---|---|
| **Dashboard** (default) — metrics from logs: event volume by engine/actor/type, error + agent-failure rate, chain-verified badge | `[M1 — this pass]` (aggregation UI over the done `PLAT-AUDIT-1` query API) |
| **View logs** — query the trail; filters: workspace (super-admin only — members are single-workspace by FR-047), project/task, work type (spec vs build vs ontology/constitution), actor (human vs agent), engine, date, event type; row-expand to full signed entry; export JSON/NDJSON + verify chain | `[M1 — this pass]` (`PLAT-AUDIT-1` done; UI this pass) |
| **Sentiment** — log-text sentiment over time | `[post-v1 placeholder]`* |
| **Intent & urgency** | `[post-v1 placeholder]`* |
| **Topics** — topic categorisation of log/interaction text | `[post-v1 placeholder]`* |
| **Satisfaction** — CSAT / CES inference | `[post-v1 placeholder]`* |
| **Quality & safety** — subjectivity, toxicity, hallucination, accuracy, completeness | `[post-v1 placeholder]`* |
| **Model metrics** — precision / recall / F1 for classifier-backed inferences | `[post-v1 placeholder]`* |

**\* Conflict flagged, recommendation given.** These log-inference views appear in **no spec or
contract** — the closest anchor is the platform's post-v1 *product usage analytics* roadmap item
(`weave-platform.md` §4 post-v1). Recommendation: ship them as **post-v1 placeholders** grouped
into the six nav items above (not ten — the human's list of nine analyses collapses cleanly into
four inference groups + satisfaction + model metrics), and add an "LLM observability / log
inference" item to the Platform post-v1 roadmap so the placeholder has a real spec home. If the
human wants any of these live in the PoC, that is new scope requiring a PRD addition — say the
word and I will spec the smallest one (sentiment over `diff_summary`/notification text) as a
candidate.

### 2.5 Settings

| Item | Status | Visible to |
|---|---|---|
| **Workspace** — name, defaults, settings cascade view (`PLAT-SETTINGS-1` effective-value + which level set it) | `[built now]` (PLAT-EPIC-003) | Workspace admin |
| **Members & roles** — invite, assign the 10 canonical roles | `[built now]` (PLAT-EPIC-004) | Workspace admin |
| **Models & AI** — model routing (fable/sonnet tiers), budget caps per the cascade | `[built now]` backend (PLAT-TASK-002 routing + PLAT-EPIC-008 budgets); thin config UI this pass | Workspace admin |
| **Billing & budgets** — metering, burn vs cap (`PLAT-BILLING-1`) | `[built now]` (PLAT-EPIC-008) | Workspace admin |
| **Notifications** — channel + type preferences (`PLAT-NOTIFY-1`) | `[built now]` (PLAT-EPIC-006) | All roles (own prefs) |
| **Integrations** — 7 managed connectors (`PLAT-CONNECTOR-1`) | `[v1.0 placeholder]` | Workspace admin |
| **Workspaces** — provision workspace + first admin, list all workspaces | `[built now]` (PLAT-EPIC-003/004, FR-045/046) | **Super-admin only** |

---

## 3. App shell layout

Blushift shell (`shell.jsx`) adapted with one deliberate change: Blushift's `SubNav` is a
*horizontal* second row; the human's intent and Foundry convention both want a **left rail** —
so the secondary nav moves to a collapsible left sidebar (spec agrees:
`weave-platform.md` §Navigation, "left sidebar — secondary navigation").

- **Top bar (44px, persistent):** brand mark → Home · **workspace switcher** (left, next to brand
  — Foundry-style; members see exactly one workspace, no switching per FR-047; super-admin sees
  all + "Add workspace") · primary nav tabs (centre) · right cluster: **⌘K command palette** ·
  notifications bell (`PLAT-NOTIFY-1`) · avatar menu (profile, settings, sign out).
- **Left rail (208px, collapsible):** section-scoped secondary nav, grouped headers, active item
  highlighted; placeholder items rendered dimmed with a phase pill ("M2", "v1.0", "post-v1").
- **Content:** breadcrumb object navigation (Foundry-style: Workspace / Section / Object) +
  page header (Blushift `PageHeader`: eyebrow, title, role/purpose lines).
- **Right inspector (320px, contextual, closable):** entity inspector on Constitution screens
  (properties + edges from `GET /api/ontology/resource/{iri}`, SHACL-shape-driven edit form,
  provenance tab); verify-chain panel on Audit (per Blushift `audit.jsx`); chat authoring panel
  docks here on Constitution screens (FR-001).
- **Command palette (⌘K):** navigate + object jump + actions ("Request application", "Verify audit
  chain", "New entity") — direct reuse of Blushift `CommandPalette`.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◆ weave │ Hammerbarn ▾ │ Home Constitution Build Events Audit Settings │⌘K 🔔 JR│
├───────────────┬──────────────────────────────────────────────┬───────────────┤
│ MODEL         │ Workspace / Constitution / Instances         │ INSPECTOR     │
│  Overview     │ ┌──────────────────────────────────────────┐ │ Order-to-Cash │
│  Explore      │ │                                          │ │ kind: Process │
│  Ontology     │ │              page content                │ │ ──────────    │
│ ▸Instances    │ │                                          │ │ performedBy   │
│ QUERY         │ │                                          │ │  → Sales Ops  │
│  Query        │ │                                          │ │ consumes      │
│  Versions     │ │                                          │ │  → OrdersDB   │
│ STANDARDS     │ └──────────────────────────────────────────┘ │ [Edit] [PROV] │
│  Glossary M2⋅ │                                              │ ───────────── │
│  Brand  M2⋅   │                                              │ 💬 Chat panel │
│  Rules  M2⋅   │                                              │  "add a step  │
│ TOOLS         │                                              │   to O2C…"    │
│  Ingest v1.0⋅ │                                              │               │
└───────────────┴──────────────────────────────────────────────┴───────────────┘
   left rail 208px          content + breadcrumb                 inspector 320px
```

---

## 4. Key-screen wireframes

### 4a. Constitution → Explore (graph view: explore + create + query)

One screen closes the M1 read half: canvas (`GE-CANVAS-1` force mode, coloured by kind), NL query
bar on top of the canvas (answer rows + generated SPARQL, grounded IRIs highlight on canvas),
inspector/chat on the right for create/update (all writes via `CE-WRITE-1`; SHACL 422 violations
render inline in the form).

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Workspace / Constitution / Explore                    version: latest ▾  ⑂ diff│
├──────────────┬─────────────────────────────────────────────┬──────────────────┤
│ MODEL        │ ┌ Ask the model ─────────────────────────┐  │ INSPECTOR        │
│  Overview    │ │ ⌕ "which systems run order-to-cash?"   │  │ ◉ Order-to-Cash  │
│  Explore ◂   │ └────────────────────────────────────────┘  │ Process · draft  │
│  Ontology    │   ┌───────────────────────────────┐         │ ──────────────   │
│  Instances   │   │      ●───●     force canvas   │         │ Properties       │
│ QUERY        │   │     /│    \   (GE-CANVAS-1)   │         │  label, owner…   │
│  Query       │   │    ● │     ●──●               │         │ Edges            │
│  Versions    │   │      ●    /    \              │         │  hasStep → …     │
│              │   │  ◉━━━●───●      ●             │         │  governedBy → …  │
│  + New       │   │ spotlight: grounded IRIs      │         │ [✎ Edit (SHACL   │
│    entity    │   └───────────────────────────────┘         │    form)] [PROV] │
│              │ ▸ Answer — 4 rows · view SPARQL ▾           │ ───────────────  │
│              │ │ system   │ service  │ process   │         │ 💬 propose via   │
│              │ │ SAP ECC  │ OrderSvc │ O2C       │         │    chat → apply  │
└──────────────┴─────────────────────────────────────────────┴──────────────────┘
  filter by kind ▾ · legend: ● Process ● System ● DataAsset ● Actor · zoom ⊕⊖
```

### 4b. Audit trail → Dashboard + View logs

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Workspace / Audit trail                          ✓ chain verified · 4,712 rows │
├──────────────┬────────────────────────────────────────────────────────────────┤
│ AUDIT        │ DASHBOARD (default)                                            │
│ ▸Dashboard   │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │
│  View logs   │ │events/d│ │by engin│ │agent vs│ │error + │                    │
│ INFERENCE    │ │ 1,204  │ │CE▓▓BE▓ │ │human % │ │fail rt │                    │
│  Sentiment ⋅ │ └────────┘ └────────┘ └────────┘ └────────┘                    │
│  Intent    ⋅ │ ┌──────────────────────────────────────────┐                   │
│  Topics    ⋅ │ │ event volume over time (area)            │                   │
│  Satisf.   ⋅ │ └──────────────────────────────────────────┘                   │
│  Quality   ⋅ │────────────────────────────────────────────────────────────────│
│  Model mx  ⋅ │ VIEW LOGS                                                      │
│              │ [workspace ▾*] [project/task ▾] [type: spec|build|ontology ▾]  │
│  ⋅ = post-v1 │ [actor ▾] [engine ▾] [date ▾]           [Export ▾] [Verify ✓]  │
│  placeholder │ ┌──────────────────────────────────────────────────────────┐   │
│              │ │ #4712 2026-07-06 CE  ce.write.apply  weave://o2c  ▸      │   │
│              │ │ #4711 2026-07-06 BE  be.gate.pass    mutation 71% ▸      │   │
│              │ │   ▾ expanded: seq, actor IRI, diff_summary, prev_hash,   │   │
│              │ │     hash, signature — verbatim signed entry              │   │
│              │ └──────────────────────────────────────────────────────────┘   │
└──────────────┴────────────────────────────────────────────────────────────────┘
  * workspace filter renders for super-admin only (members are single-workspace)
```

---

## 5. RBAC matrix — super-admin vs client/member

Per the platform spec (§Canonical human roles, FR-045/046/047), the **super-admin is a
provisioning-only operator outside tenant RBAC — it does not read tenant business data.** This is
stronger than "different nav": most of the app is *absent* for the super-admin. "Member" below =
the client-side composite (workspace admin sees everything in its column; narrower roles see the
subset noted).

| Surface / action | Super-admin (platform operator) | Client workspace admin | Client member (non-admin roles) |
|---|---|---|---|
| Workspace switcher | All workspaces + **Add workspace** | Own workspace only (no switcher UI) | Own workspace only |
| Create workspace + first admin user | ✅ (Settings → Workspaces) | ❌ | ❌ |
| Home dashboard | ❌ (no tenant data) | ✅ | ✅ (own workspace, FR-047) |
| Constitution — read/explore/query | ❌ | ✅ | ✅ (all roles read) |
| Constitution — author instances/glossary | ❌ | ✅ | Per role: analyst/SME, data steward |
| Constitution — author ontology/shapes | ❌ | ✅ | Enterprise architect only |
| Constitution — publish version | ❌ | ✅ | `publish` role holders |
| Build — request application | ❌ | ✅ | Engineer, enterprise architect |
| Events (placeholder section) | ❌ | ✅ (visible) | Automation author (visible) |
| Audit trail — dashboard + logs | Platform-ops events only (provisioning, own actions) | ✅ full workspace trail | Compliance officer full; others own-activity only |
| Audit — workspace filter | ✅ (across workspaces, ops events) | n/a (single workspace) | n/a |
| Audit — export + verify chain | ✅ (ops scope) | ✅ | Compliance officer |
| Settings — members/models/billing/notifications | ❌ | ✅ | Own notification prefs only |
| Settings — Workspaces (provisioning) | ✅ | ❌ | ❌ |

PoC simplification: implement **three concrete logins** — super-admin, workspace admin, and one
member (business analyst) — enough to demonstrate every row above without building all ten roles'
UI states.

---

## 6. Marketing index (public landing page)

Convention-following single page, Blushift visual language, links to `/login` and `/signup`.
Section order:

1. **Header** — logo, Product / Pricing / Docs anchors, Login (ghost) + Get started (primary).
2. **Hero** — headline ("The operating system for the AI-native company"), subhead (model your
   business as a live knowledge graph; generate the apps, agents, and automations that run it),
   primary CTA + "Book a demo"; hero visual = graph-canvas screenshot.
3. **Social proof strip** — dummy client logos.
4. **How it works** — three steps mirroring the loop: **Model** (Constitution) → **Ask & see**
   (NL query + Explorer) → **Generate** (Build); one screenshot each.
5. **Feature grid** — four engine cards (Constitution · Build · Events · Explorer) + two
   platform cards (Audit & provenance · Open standards / own-your-code — the anti-lock-in moat
   from the spec's positioning).
6. **Screenshot band** — full-width app shots (graph view, audit dashboard).
7. **Pricing (dummy)** — three tiers: Starter / Team / Enterprise, "per workspace / month",
   Enterprise = "Talk to us"; feature checklist rows.
8. **Final CTA** — sign-up banner.
9. **Footer** — product links, dummy legal, copyright.

---

## 7. Blushift / Foundry mapping

**Reuse from Blushift directly:**

| Blushift asset | Reused as |
|---|---|
| `shell.jsx` `TopNav` + tab pattern | Primary nav bar (tabs renamed; workspace switcher added left) |
| `shell.jsx` `CommandPalette` | ⌘K palette (nav + objects + actions) |
| `shell.jsx` `NotificationsDropdown` / `AvatarDropdown` | Bell + user menu, unchanged pattern |
| `primitives.jsx` (`Btn`, `Pill`, `Kbd`, `Avatar`, `PageHeader`, `surface`/`inp`/`row-hover`) | Base component set |
| `styles.css` tokens (`--bg`, `--surface`, `--line`, `--text-*`, accent colours) | Visual language (reconcile with `docs/standards/design/` tokens before build) |
| `screens/audit.jsx` | Audit → View logs: filter row + expandable signed-entry rows + right verify-chain rail — near-verbatim fit for `PLAT-AUDIT-1` |
| `screens/org-graph.jsx` | Constitution → Explore layout (canvas + inspector) |
| `screens/settings.jsx` / `workspace-settings.jsx` | Settings section screens |
| `screens/workspaces.jsx` | Super-admin Settings → Workspaces provisioning list |
| `screens/login.jsx` | Login/sign-up |
| `screens/company.jsx` / `portfolio.jsx` | Home dashboard tile grid |

**Adaptation (deliberate, one):** Blushift's `SubNav` is horizontal; this proposal replaces it
with a **left rail** per the human's intent, the platform spec, and Foundry convention. Keep
Blushift's type scale and hover/active treatments on the rail items.

**Adopt from Foundry:** persistent left object rail with grouped headers · top workspace
switcher · object explorer + right contextual inspector (properties/edges/history tabs) ·
breadcrumb object navigation (Workspace / Section / Object) · ⌘K palette as first-class
navigation · phase-pill "coming soon" treatment on gated features.

---

## 8. Phase-placeholder inventory

Every surface rendered as **"Delivered in phase X"** in the PoC:

| Surface | Nav location | Phase label | Spec anchor |
|---|---|---|---|
| Model-health overview (full tiles) | Constitution → Overview | **M2** | `CE-METRICS-1`, CE EPIC-005 |
| Glossary (SKOS) | Constitution → Glossary | **M2** | CE EPIC-003 |
| Brand & voice | Constitution → Brand & voice | **M2** | CE EPIC-004, `CE-BRAND-1` |
| Rules & policies (tenant SHACL, governance) | Constitution → Rules & policies | **M2** | CE EPIC-005 |
| Strategy & motivation | Constitution → Strategy & motivation | **M2** | CE EPIC-005 content area |
| Visual graph editing, overlays, saved views | Constitution → Explore (upgrade) | **M2** | Explorer M2 |
| Document / EA-export / diagram ingest | Constitution → Ingest | **v1.0** | CE EPIC-012 |
| OWL reasoning views | Constitution → Reasoning | **post-v1** | CE EPIC-008 |
| Project registry | Build → Projects | **v1.0** | Build E2 |
| Build dashboard | Build → Dashboard | **v1.0** | Build E3 |
| Kanban | Build → Kanban | **v1.0** | Build E4 |
| Task briefs + decision log | Build → Tasks & decisions | **v1.0** | Build E5/E7 |
| Automations / Triggers / Runs (entire section) | Events → * | **post-v1** | spec §1.1 row 5, `EA-AUTOMATION-1` |
| Log-inference views (sentiment, intent & urgency, topics, CSAT/CES, quality & safety, precision/recall/F1) | Audit trail → Inference group | **post-v1** *(proposed — no spec anchor yet; add to Platform post-v1 analytics)* | `weave-platform.md` §4 post-v1 (nearest) |
| Integrations (7 managed connectors) | Settings → Integrations | **v1.0** | `PLAT-CONNECTOR-1` |
| Generative dashboard (AI-composed widgets) | Home (upgrade) | **M2** | Platform E1 |
| C4 mode + realtime collab canvas | Constitution → Explore (mode) | **post-v1** | Explorer post-v1 |

---

## 9. Decisions requiring sign-off

1. **Add Home as item #1** (built, spec-mandated) — or fold into brand-mark click.
2. **Explorer inside Constitution for PoC**, promoted top-level at M2.
3. **Audit log-inference views ship as post-v1 placeholders** + roadmap addition; none built in
   this pass unless explicitly pulled in as new scope.
4. **Keep labels "Events" and "Audit trail"** over spec's "Automate"/"Compliance" until M2.
5. **Org chart dropped from PoC nav** (no M1 epic; Actors browsable under Instances).
6. **Three demo logins** (super-admin / workspace admin / analyst) stand in for the full
   10-role matrix.

---
type: Design
title: "Research — enterprise app-shell patterns"
description: "WS2 competitor/pattern research: Linear, Notion, Airtable, Retool, Supabase Studio,
  Vercel, Stripe, ServiceNow, Atlassian/Jira — with the top-12 transferable shell patterns for
  Weave and a body-size/density recommendation."
tags: [design, research, app-shell, navigation, typography]
status: "Complete — WS2 input (sonnet research agent, 2026-07-09)"
timestamp: 2026-07-09T00:00:00Z
resource: docs/design/research/enterprise-app-shell-patterns.md
source: sonnet research agent (web), WS2 design assessment
owner: gazzwi86
---

# Enterprise app-shell research

## Per-product findings

### Linear

- No fixed top header in the traditional sense — an "inverted L-shape" (Karri Saarinen): persistent
  left sidebar plus a thin top strip of view-level chrome (filters, display options) that changes
  per view. Sidebar fixed; content transitions via animation.
- Global chrome (sidebar + tabs) and view-level headers (filters, toggles) are two separately
  componentized layers — a first-class design decision.
- Type scale (public reverse-engineering; closest available to official): display-xl 80 →
  headline 28, card-title 22, body-lg 18, **body 16**, **body-sm 14**, caption 12, button 14/500,
  eyebrow 13/500, mono 13. Inter Display headings, Inter body; top-nav items ~13px/400.
- Density: 4px-based spacing scale; cramped-feel fixed via **alignment discipline** (both axes),
  not extra whitespace — "reduce visual noise, increase hierarchy density".
- Forms: side-panel/drawer edits — never navigates away from the list.
- Notifications organized by channel (criticized in 2026 UX writing); the proposed fix worth
  stealing: **Urgent (interrupt) / Updates (later) / Activity (digest)** tiers.

### Notion

- Sidebar 224px fixed, 8px base grid; top block (Search/AI/Home/Inbox) 131px; 30px search bar,
  22px icons, 8px radius rows; full-row click targets.
- Grouping: workspace name → search → primary nav → Favorites → Teamspaces/Shared/Private, utility
  items pinned bottom. 2025: Home folded into the sidebar (nav + AI threads + notifications).

### Airtable

- Left sidebar for cross-workspace nav with collapse toggle; single-page interfaces suppress nav.
- **Lesson from failure**: mandatory interface sidebar drew pushback for eating 15–20% of work area
  on small screens — collapse was added reactively. Cautionary for dual top+side nav at laptop
  width.
- Interface Designer treats forms as first-class page layouts (drag-drop field grouping).

### Retool

- Card/dropdown app-switcher as primary nav. Forms guidance from their docs: top-aligned labels
  standardized everywhere; two brand colours max in nav/header; conditional/stepped containers to
  progressively disclose long forms.

### Supabase Studio

- Dark-native near-black with a single emerald accent; **depth via border contrast, not shadows**
  (nested border tones + a 30%-opacity accent border for "elevated") — the dark-mode-safe
  elevation model. Ships `supabase/ui` on shadcn — same base Weave uses.

### Vercel

- Jan-2026 dashboard: header-only nav (no sidebar), breadcrumb trail above the page title,
  optimized for drill-down. Viable at Vercel's density; Weave's authoring surfaces are denser and
  likely still need the sidebar.

### Stripe

- **Typography behaviour worth stealing**: separate OpenType feature set (`tnum`) for numeric data
  so table numbers align; letter-spacing tightens progressively with size (−1.4px at 56px → normal
  below 16px).
- **Density philosophy: "dense data, generous chrome"** — grids tightly packed, surrounding chrome
  (headers, tab bars, dividers) generously spaced. The clearest anti-cramped answer studied.
- Moved card-heavy → flatter "cardless" gradually, not one rewrite.

### ServiceNow (Next Experience / Polaris)

- Unified global search; role-scoped configurable "workspaces"; rollout staged per-user via a
  preference flag before default. (Thinner section — official specifics gated.)

### Atlassian / Jira (2024–25 nav)

- Persistent left sidebar for cross-project nav; in-page tabs for views within a project; project
  settings in per-row overflow menus.
- Rationale: "finding work" was the pain, not density; consistency must coexist with per-area
  flexibility. Rollout: extension prototype → 160-user study → EAP (100 sites) → beta (2.7%
  opt-out) → GA.

### Notifications cross-product synthesis

Consensus = **tiered attention model**: Urgent/real-time (mentions, assignments, security, ~1–2s,
own channel) / Updates (status changes, watched items) / Activity-digest (batched, quiet hours,
snooze). GitHub has the most worked-out targeting: notification *reasons* (participating,
mentioned, subscribed), per-repo type filters, cross-channel read-state sync.

## Top 12 transferable shell patterns for Weave (ranked)

1. **Two nav layers, never mixed**: top header switches areas (Home/Constitution/Build/…); left
   sidebar owns everything inside an area (Linear, Jira).
2. **Tiered notifications (urgent/updates/digest)**, not a flat feed — maps onto
   `docs/design/notifications-recommendation.md` types.
3. **Drawer/side-panel for record edits**, not modal or full-page nav — ontology/entity/request
   edits open over the list/graph, preserving context.
4. **Inline on-blur validation** (measured 42% faster completion, 22% fewer errors) — SHACL
   violations surface per-field as you type/blur, not at submit.
5. **Breadcrumb below global nav, above page title; tabs inside the page** —
   `Hammerbarn / Constitution / Instances / Order-to-Cash`, then title + primary action, then tabs.
6. **Alignment discipline over whitespace** as the anti-cramped lever (Linear).
7. **Dense data / generous chrome** (Stripe) — grids dense, page chrome generous.
8. **Tabular numerals everywhere numbers column** (`font-variant-numeric: tabular-nums`) — already
   a token rule (`typography.md` mono usage); enforce in audit/compliance tables.
9. **Full-row click targets + strict 8px grid in the sidebar** (Notion).
10. **Border-based elevation, not box-shadow** (Supabase) — matches the design system's
    "elevation via lightening" principle; use a border-tone ladder for hover/selected.
11. **Sidebar collapse toggle on day one** (Airtable's lesson) — Weave's wide authoring forms will
    feel it at laptop width immediately.
12. **Stage shell rollouts** (ServiceNow flag; Atlassian EAP) — for any future shell v2.

## Body size / density recommendation

Research's market read: 2026 norms = **14px body / 13px secondary-and-dense-cells** (Linear,
Stripe), with 16px as the outer bound. Weave's locked token scale is **15px body / 13px body-sm**
(`docs/standards/design/typography.md`), and the user has asked for type to go *up*, not down.

**Resolution — no token change proposed**: keep `--text-body` 15px as primary body (slightly above
market median, consistent with the "comfortable on dark canvas" rationale), use `--text-body-sm`
13px for dense table cells/meta exactly as the market splits it, and adopt Stripe's
dense-data/generous-chrome + Linear's alignment discipline as the density levers. The real
deviation found in the PoC is headings (h1 rendering 28/600 instead of the 36/700 token), not
body size.

## Gaps flagged by the researcher

- Linear sidebar width / header height are community-inferred, not official.
- ServiceNow specifics gated; section thinner.
- Ant Design's `48+8n` header-height formula cited as general enterprise convention only.

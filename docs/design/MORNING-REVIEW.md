---
type: Design
title: "WS2 design assessment — morning review package"
description: "Index of the WS2 overnight deliverables (assessment, JTBD, notifications, research,
  mocks) plus the six queued decisions and their outcomes from the 2026-07-09 morning MCQs."
tags: [design, ws2, review, index]
status: "Complete — all 6 decisions answered 2026-07-09"
timestamp: 2026-07-09T00:00:00Z
resource: docs/design/MORNING-REVIEW.md
source: WS2 design assessment session
owner: gazzwi86
---

# WS2 design assessment — morning review package (2026-07-09)

Everything below was produced overnight. Nothing is committed yet; no harness files were touched.
Suggested order: skim the assessment (10 min) → open the three mocks (10 min) → answer the MCQs.

## 1. Read

| Doc | What it is |
|---|---|
| `docs/design/design-assessment-2026-07-09.md` | 27 findings (5 Blockers) from live click-through, + council synthesis |
| `docs/design/jtbd.md` | Job-to-be-done per surface — becomes the design-QA lens |
| `docs/design/notifications-recommendation.md` | 8 notification types, role defaults, channel plan |
| `docs/design/research/graph-canvas-ux-patterns.md` | Bloom/Foundry/Kumu/etc — top-10 patterns for Explorer + query |
| `docs/design/research/enterprise-app-shell-patterns.md` | Linear/Stripe/Notion/etc — top-12 shell patterns + density ruling |

## 2. Open the mocks (double-click each file in Finder, or open in Chrome)

All three: same 3 screens (Home / Instances / Explore & Ask) via the pill switcher at the bottom
of the page. Same Hammerbarn data, same tokens — only the shell philosophy differs.

| Mock | File | One-liner |
|---|---|---|
| **V1 Calm Foundry** | `docs/design/mocks/mock-v1-calm-foundry.html` | Closest to the approved IA: top tab bar + 220px rail, breadcrumb PageHeader, quiet premium |
| **V2 Linear Dense** | `docs/design/mocks/mock-v2-linear-dense.html` | Icon rail + contextual sidebar, ⌘K command bar as the hero, denser, keyboard-first |
| **V3 Canvas First** | `docs/design/mocks/mock-v3-canvas-first.html` | The graph IS the home; glass panels float over the living canvas; boldest |

The empty dashboard, corner-clumped graph, raw IRify, and silent query from the current PoC are
all "fixed by construction" in each mock — compare against the screenshots described in the
assessment findings.

## 3. Decisions queued — ALL ANSWERED (user MCQs, 2026-07-09 morning)

> Outcomes: direction = **V4 hybrid** (V3 body + V2 chrome + logo.png — see
> `visual-direction.md`; reference mock `mocks/mock-v4-hybrid.html`); all 5 Blockers → v1 now;
> Compliance stays under Audit trail (`/audit/compliance`); design agent approved (advisor consult
> run); publish notifications batched per session; tenancy sweep confirmed. Requirements ledger:
> `v1-design-requirements.md`. Original questions kept below for the record.

1. **Visual direction** — V1 / V2 / V3, or a named hybrid (e.g. "V1 shell + V2 command bar + V3
   ask-on-canvas"). My recommendation: **V1 shell as the base + V2's command palette/search bar +
   V3's NL-ask-grounded-on-canvas for Explore & Query**. Rationale: V1 matches the approved IA and
   is cheapest against the existing app; the palette and canvas-ask are the two highest-leverage
   borrows from research.
2. **Blocker remediation scope** — the 5 Blockers (empty dashboard, no instance browser, broken
   Explorer layout, silent NL query, dead marketing CTAs) become v1 task requirements now; confirm
   none is deferred.
3. **Compliance placement** (finding F-D23) — keep under Audit trail (approved IA) vs promote
   top-level (platform spec). Recommendation: keep under Audit trail until M2 reconciliation, fix
   the route to `/audit/compliance`.
4. **Publish-notification noise** (notifications doc) — `model.version.published` to all members
   (ruling letter) vs model-role members only vs batched. Recommendation: batched per session.
5. **Design agent** — approve the proposal shape (scratchpad
   `design-agent-proposal.md`; summary: sonnet agent adds Design-requirements sections to
   UI-bearing briefs at /architect time + verifies them at /qa time; needs advisor consult + your
   HITL before touching `.claude/`).
6. **Tenancy wording sweep** (F-D04) — not really a choice (ruling already binds): confirm I write
   the v1 requirement to remove the sub-workspace switcher + "every workspace" copy.

## 4. What happens after your answers

Per the consolidation plan: findings + chosen direction → design requirements attached to v1 task
briefs (feeds WS1 step-4 /architect), updates to `poc-ia-proposal.md` + design standards
(standards edits go through harness governance), then WS3 gate close-out.

## Loose ends

- `docs/standards/testing-ts.md` + `design/data-viz.md` stale spec paths → logged as PROJ-010
  (harness-governed fix, pending advisor consult).
- `.claude/.gitignore` (+`state/limit-hit`) still uncommitted — your call from yesterday.
- All WS2 docs above are uncommitted; I'll commit after your review (suggested:
  `docs(design): WS2 design assessment package`).

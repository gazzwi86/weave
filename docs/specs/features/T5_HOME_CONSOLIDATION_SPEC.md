---
title: "T5 — Home consolidation: Dashboard as the canonical, post-login Home"
type: feature-spec
status: draft
created: 2026-07-18
owner: unassigned
source: T4 coverage-reconciliation decision (2026-07-18); decision_home-and-canvas-surfaces
---

# T5 — Consolidate Home into `/dashboard`

## 1. Intent
Weave currently ships **two** home-like surfaces: `/role-home` (a guided, role-aware landing —
next-action banner, capability cards, completeness map, guided-tour anchor) and `/dashboard`
(a widget grid + activity feed + get-going + onboarding checklist). The signed-off mock has a
**single Home**. **Decision:** `/dashboard` is the canonical Home and the **post-login landing
page**; `/role-home` is retired **after** its unique surface is migrated into the dashboard. No
functionality is dropped in the interim.

## 2. Current state (2026-07-18)
- `/dashboard` (`app/dashboard/page.tsx`) already has: `ChecklistWidget` (onboarding), `GetGoing`,
  `NeedsYou`, `ActivityFeed`, widget grid, prompt bar. Eyebrow section headers applied (V1).
- `/role-home` (`app/role-home/page.tsx`) has the UNIQUE surface the dashboard lacks:
  - **Next-action banner** — `data-tour-id="plat.role-home.next-action"`, sourced from
    `GET /api/role-home` `next_action` (label + href). The "do this next" guidance.
  - **Capability cards** — role-scoped capabilities (`RoleHomeCapability[]`), rendered by
    `CapabilityCard`.
  - **Completeness map** — per-kind coverage (`CompletenessRow[]`).
  - Guided-tour anchor(s) that the driver.js onboarding tour targets.
- Backend: `GET /api/role-home` (`routers/role_home.py`) returns `{capabilities, summary,
  next_action, completeness}`. This endpoint stays; the dashboard consumes it.
- Both are in the primary nav (`components/shell/nav-items.ts`).

## 3. Scope (what to build)
1. **Migrate role-home's unique surface into `/dashboard`:**
   - Next-action banner (reuse the same component/markup + `data-tour-id`), fed by `GET /api/role-home`.
   - Capability cards.
   - Completeness map.
   Compose them into the dashboard layout in a sensible order (suggested: prompt bar → next-action
   banner → NeedsYou → KPI/widgets → capability cards + completeness → activity feed → get-going).
   Reuse existing components; do not duplicate. Keep the Eyebrow header treatment.
2. **Make `/dashboard` the post-login landing page.** After sign-in, users land on `/dashboard`
   (today the post-login destination is `/ce` or `/role-home` — confirm and update the auth
   redirect / default route).
3. **Retire `/role-home`:** remove it from the primary nav; redirect `/role-home` → `/dashboard`
   (next.config redirect, additive — no 404 for old links/bookmarks/tour deep-links). Only delist
   AFTER the migration in (1) is complete and verified.
4. **Re-anchor the guided tour:** the onboarding/driver.js tour steps that target
   `plat.role-home.next-action` (and any other role-home anchors) must retarget the migrated
   elements on `/dashboard`. Verify the tour runs end-to-end on the new Home. Update the tour-anchor
   registry (`packages/shared/onboarding/anchors.ts`) — any `data-tour-id` must be registered with a
   `planted_by` matching `^TASK-\d{3}$` or the shared CI gate fails.

## 4. Non-goals / deferred
- Seed/metrics population (the KPI/next-action data being sparse in the demo is a separate,
  deferred data task — G12 / CE-METRICS / registry summary).
- No new backend endpoints — `GET /api/role-home` already provides the data.

## 5. Acceptance criteria
- `/dashboard` renders the next-action banner, capability cards, and completeness map (data from
  `GET /api/role-home`), in addition to its existing widgets/checklist/activity.
- Post-login lands on `/dashboard`.
- `/role-home` is not in the nav; visiting it redirects to `/dashboard`; no route 404s.
- The guided tour runs to completion on `/dashboard` (anchors retargeted + registered).
- tsc + eslint + vitest green; affected tests updated; e2e tour/first-sign-in specs updated.

## 6. Risks
- **Tour breakage** is the top risk — the tour deep-links to role-home anchors. Migrate + retarget
  as one unit; do not delist role-home before the tour passes on dashboard.
- Two `RoleHomeCapability`/`CompletenessRow` type sources may exist (role-home vs dashboard) —
  reuse one, don't fork.

## 7. Rough sizing
Feature-scale, ~1 focused day. Best as a dedicated effort with its own PR(s), not squeezed through
the 30-minute loop. A **UI placeholder** ships first (see the placeholder task) so the intent is
visible before the full migration.

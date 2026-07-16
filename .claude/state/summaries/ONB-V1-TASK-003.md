# ONB-V1-TASK-003 — Role-Home Guidance + Competency-Question beacon

**Status:** done (PR #107, feature/ONB-V1-EPIC-003, sibling to EPIC-002). 6 commits.

## Delivered
- 5 `plat.role-home.*` anchors planted + `shipped:true` (ADR-008, same commit): 4 on `app/role-home/page.tsx`, 1 on `SecondarySidebar.tsx` nav row (literal branch, not interpolated — audit-anchors scans a literal regex).
- Competency beacon gates on `add-competency-questions` checklist state via new pure `isChecklistItemOpen` (`packages/shared/onboarding/derive-checklist.ts`), fed by the single existing `/api/onboarding/state` read (extended to expose `signals`+`rolePath` — zero new fetches, zero CE reads; backend schema already models these fields).
- Welcome modal + `tour.plat.role-home` were pre-configured by TASK-001; this task made the anchors real.

## Gates
Vitest 1648 frontend + 92 shared pass; tsc clean; lint 0 errors (frontend + shared); audit-anchors both-ways green (871 files). 2 E2E `test.fixme` (sandbox no-Postgres for Playwright webServer).

## Follow-ups (flagged, NOT blockers — see overnight-queue)
1. Competency self-mark has NO UI path: `/help/training` lacks a per-article mark-done CTA; item deepLink `/training/declare-competency-questions` resolves to no route; `checklist-widget.tsx` SELF_MARK_MILESTONE_ID map omits `add-competency-questions` and defaults `currentPhase` "m1" (locks this M2 item). Hide-on-complete covered at unit/integration. → needs a follow-up task (checklist-widget territory).
2. Forward-compat Minors (correct for current milestone): `onboarding-hints-host.tsx` beacon phase hardcoded "m2"; `derive-checklist.ts` locking uses `!==` not phase-ordering `<`.
3. AC-003-01 per-path copy variants: no per-path text-variant schema exists (one step list gated to all 4 paths) — read as satisfying AC-as-written; per-path text would need a config schema change (out of scope).

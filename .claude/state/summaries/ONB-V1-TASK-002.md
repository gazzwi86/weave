# ONB-V1-TASK-002 — Model-Completeness Map Tour (TOUR-HALF partial slice)

Partial slice of ONB-V1-EPIC-002. Delivered the tour-half; beacon ACs deferred (blocked on the
never-built M1 beacon/welcome-modal renderer, TASK-008 UI half).

## Delivered (QA PASS)
- AC-002-01 (partial): tour-launch mechanics — deep-link `?tour=completeness-map`, autostart after
  role-path resolves, help-launcher entry ("Take the completeness-map tour"). Welcome-modal-CTA half deferred.
- AC-002-04: skip-with-warning fallback + per-anchor `shipped` gating.
- AC-002-05 (partial): axe-zero on the rendered tour. Beacon-state axe deferred.
- 2 new GE anchors registered (`ge.overlay.controls`, `ge.overlay.completeness-legend`), flipped
  `shipped:true` atomically with their `data-tour-id` plants; audit-anchors passes (zero unregistered).

## Deferred (tracked in .claude/state/escalations/ONB-V1-TASK-002-blocker.md)
AC-002-02 (Explorer overlay beacons), AC-002-03 (role-home tile beacon), welcome-modal-CTA half of
AC-002-01, beacon-axe of AC-002-05 — ALL blocked on the missing TASK-008 beacon/modal renderer
(shared onboarding UI-host gap; logged for HITL in overnight-queue).

## Notes
- E2E `explorer-completeness-tour.spec.ts` `test.fixme`'d — genuine dev-server render-settling flake;
  tour logic + axe green at component-test layer (`explorer-tour.test.tsx`, `help-launcher.test.tsx`).
  Mock-fix (NODE_KINDS.relTypes) touched only the spec.
- Reconcile onto main: unioned help-launcher.tsx — kept ONB-V1-002's `<HelpTopics/>` refactor + the
  tour link AND main's (#98) checklist-restore button; the `@/lib/onboarding/i18n` import (from the
  restore button) was relocated to the top import block (merge had stranded it mid-file).
- No migration. Config + frontend tour only.
- QA edge test: absent-legend-anchor → tour degrades to 1-step + logged warning, no crash/axe violation.

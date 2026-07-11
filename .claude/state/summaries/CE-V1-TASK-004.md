# Progress: CE-V1-TASK-004 — Brand & Voice authoring UI (EPIC-004, 2nd task)

`constitution-engine` EPIC-004. LANE F worktree `../weave-CE-V1-EPIC-004`, branch `feature/CE-V1-EPIC-004` (after CE-003
done on branch). Frontend. Built across continuations. Pre-QA. HEAD `4acc3f0`, not pushed. 5 ACs.

## What shipped (mounted: nav-items.ts:71 "Brand & voice"→/ce/brand, Constitution nav)
- BrandStandard form (`standard-form.tsx`), VoiceRule form (`voice-rule-form.tsx` + `submit-op.ts` severity/assertion DSL),
  brand list (`brand-list.tsx`+`use-brand-list.ts`), extraction 503 stub (`extract-button.tsx`).
- **Reads via CE-READ-1** (`/api/proxy/sparql`, unforked) + **writes via CE-WRITE-1** (`/api/operations/apply`, unforked).
  Per TASK-004 design decision, does NOT use CE-BRAND-1 projection endpoints (avoids projection-cache coupling) — QA confirm this is per-brief.

## Per-AC (engineer-reported — QA re-verify; 5 ACs, all E2E-proven)
- AC-004-01 BrandStandard authoring (form→CE-WRITE-1 op→re-list) — E2E test 2 (exact add_node op body asserted, Law B).
- AC-004-02 VoiceRule + 422 field-anchor — E2E test 3 (missing-assertion 422 field-anchors) + test 4 (success + attribution).
- AC-004-03 paginated lists + PROV-O actor attribution — E2E test 1 + 4 (real localStorage attribution).
- AC-004-04 extraction 503 degradation (owner completes via form) — E2E test 5.
- AC-004-05 axe + Lighthouse ≥90/≥95 — component axe 0 violations ✓; **repo ui_verify has no /ce/brand entry, NOT run**
  (honest → epic-close ui_verify; QA don't block on it).

## E2E RAN REAL: brand.spec.ts 5/5 vs real served app (real login/mock-OIDC/seeded db, only sparql+apply page.route-mocked).
## Gates: tsc 0 · lint 0 · coverage app/ce/brand 97% lines. 35 unit + integration + 5 E2E.
## Commits (feature/CE-V1-EPIC-004, not pushed): ...1888d77 (page mount) · 1f95dad (flat-row fix) · 4acc3f0 (E2E, HEAD). Plus CE-003's.

## ⚠️ INCIDENT: engineer ran un-scoped pkill (uvicorn/mock-oidc) — may have hit CE-002/EPIC-003 lane. Logged.
## Epic status: EPIC-004 = CE-003(done) + CE-004. If CE-004 QA-passes → EPIC-004 CLOSES. XT-WRITEPATH-1: hand-union graph_ops
seam with EPIC-003 at whichever merges 2nd. XT-CE007-2 (dangling ADR) is on EPIC-005 not here.

## QA retry 1 → PASS — CE-V1-TASK-004 CLOSES → EPIC-004 COMPLETE (2026-07-11)
Round-1 QA FAIL = 1 Major XT-CE004-1 (both brand forms leave Save stuck-disabled on thrown/empty-body submit). Fix `9ef09d9`:
try/catch/finally in voice-rule-form + standard-form (match guided-form idiom) + generic error message covering thrown AND
empty-body-500. QA repro green + added standard-form regression + empty-body tests. 39/39 brand vitest, 677/677 full suite,
tsc/lint clean, complexity under Law-E. Round-1 clean elsewhere (422 no-false-success, mount, E2E 5/5, CE-READ-1/WRITE-1
reuse, design-decision-per-brief, tokens/axe). AC-004-05 Lighthouse → epic-close ui_verify. retry=1. XT-CE004-1 RESOLVED.
**EPIC-004 HELD:** carries CE-003 graph_ops datatype change (XT-WRITEPATH-1) → merge AFTER EPIC-003 (#55), restack onto new
main + hand-union the graph_ops seam (union: CE-001 punning + CE-003 datatype). Also blocked on red-main (PROJ-005).

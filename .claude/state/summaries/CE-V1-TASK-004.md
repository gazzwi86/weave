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

---
title: "Phase Gate: build-engine-v1 / Phase 1"
status: Approved
phase: build-engine-v1/phase-1
date: 2026-07-14
security_verdict: PASS
mutation_score: 60%+ (CI-enforced, per-PR)
---

# Phase Gate: build-engine-v1 / Phase 1

> **Governing principle.** A phase gate protects the next phase from inheriting unresolved debt.
> If any quality signal is red, the phase is paused, not ended. Every section below is
> evidence-based, not optimistic.

## Gate Criteria

**Phase:** build-engine-v1/phase-1 (cross-engine v1 wave — PLAT / CE / ONB tasks built in parallel
worktree lanes)
**Triggered:** all tasks in the active phase at `done`; `progress.sh phase-check` = COMPLETE
(84/125 program tasks done; the remaining 41 are later-milestone tasks gated behind this advance)
**Approver:** Human (HITL) — this gate is the **engine-boundary sign-off** releasing
`onboarding/phase-1`.

## Checklist

### Deliverables

- [x] All tasks in the active phase marked Done (phase-check = COMPLETE)
- [x] All tests passing — every merged PR green on real CI gates
      (api, integration, web, shared, mutation-a, mutation-b, semgrep, secrets)
- [x] Test coverage meets threshold — enforced per-PR in CI (≥ 80%)

### Quality

- [x] No lint errors — ruff + mypy + tsc + eslint green per-PR (pre-commit + CI)
- [x] Complexity within thresholds — Plugin Law E enforced per-PR
- [x] QA review complete — every epic had a non-authoring-reviewer pass; tenancy-critical PRs
      (#91 recent-edits, #92 activation poller) re-reviewed twice; zero Blocker/Major at merge
- [x] No unresolved failure reports — escalations triaged (see Notes); none block this phase
- [x] Mutation score ≥ 60% — CI mutation-a + mutation-b GREEN on all 5 merged PRs (#88/#90/#91/#92/#93)

### Artifacts

- [x] PRs created and reviewable — 5 epic PRs, all merged; 0 open
- [x] Commits follow conventional format — feat/fix/docs/chore throughout
- [x] Documentation updated — ADRs (incl. ADR-022 pin-semantics, preserved from a numbering
      collision); per-task summaries in `.claude/state/summaries/`

### Environment

- [x] App runs locally — Next.js `npm run dev` / FastAPI `uv run uvicorn`
- [x] Test suite runs — `uv run pytest` (Python) / `npm test` (TS); isolated-docker integration per lane
- [x] Build succeeds — `npm run build`; CI build stage green per-PR
- [x] Multi-tenancy isolation re-asserted — security backstop PASS (see Security)

## Security

**Verdict: PASS — zero HIGH/CRITICAL.** Independent backstop review of all 5 merged PRs' code
(not PR descriptions), on top of the per-PR semgrep + secrets CI gates:

- Multi-tenancy: every CE call forwards `ce_headers`; fail-closed guards
  (`coverage_gap.require_headers` → `CeReadUnscoped`, `ce_metrics._require_headers` →
  `CeMetricsUnavailable`) on all data-bearing CE calls. The one unguarded CE call
  (`role_home.py` → `/api/ontology/types`) hits the tenant-agnostic BPMO grammar endpoint (no tenant
  data — not a finding). Migration 0084 `list_pollable_tenants()` is read-only, single-column,
  `SECURITY DEFINER`, explicit `SET search_path`, narrow GRANT.
- SQLi: all asyncpg queries parameterized; the 2 `reorder_widgets` `nosemgrep` lines are genuine FPs
  (static quoted `"position"` identifier, values bound `$1–$4`).
- Auth boundary: all routes `Depends(get_current_principal)`, scoped via `tenant_connection`.
- IDOR: pin/update/delete/publish pre-check owner → 404-not-403 on foreign rows.

Non-blocking defense-in-depth note (deferred, not a finding): `store.pin_widget` / `store.delete_widget`
scope the SQL by `tenant_id + id`, relying on the router owner pre-check for owner-scoping; adding
`AND owner_principal_iri = $n` there would be belt-and-suspenders.

## UI Verification

**Verdict: GREEN by CI E2E evidence.** The 4 UI features delivered this phase each carry a real
Playwright E2E spec on main, which ran green via the per-PR CI `web` gate on the exact merged commits:

- `dashboard-widget-actions.spec.ts` (pin/reorder/publish — #93)
- `recent-edits-widget.spec.ts` (#91)
- `role-home.spec.ts` (#90)
- `onboarding-activation-toast.spec.ts` (#92)

**Disclosure (gate's weakest point):** a live in-gate `ui_verify.sh --full` re-run was **not**
executed — it requires serving the full multi-service stack (backend + frontend + oxigraph +
Postgres + LocalStack), a cloud-cost/time constraint (Plugin Law F: synthetic-only). The substitute
is the identical Playwright specs run by CI (not the engineer) on the merged commits — the same
deterministic enforcing seam, executed in CI rather than re-run here.

## Cost Summary

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Total tokens (input) | — | N/A (not instrumented) |
| Total tokens (output) | — | N/A (not instrumented) |
| Total cost | — | N/A (not instrumented) |
| Variance | — | — |

## Decision

- [x] **Approve** — proceed to next phase (`onboarding/phase-1`)
- [ ] **Amend** — address specific items before proceeding
- [ ] **Reject** — significant rework needed

## Notes

Approved by human (HITL) 2026-07-14 — engine-boundary sign-off releasing `onboarding/phase-1`.
Approver accepted the disclosed UI-verify substitution (CI-run Playwright E2E in lieu of a live
in-gate `ui_verify.sh --full`). Followups below carried forward, none blocking.

**Escalation triage (evidence for "no unresolved failure reports"):**

- `GE-TASK-001-resolved.md` — RESOLVED (closeable).
- `TASK-001-blocker.md` — disclosed-default (benchmark param substitution, stated in ADR-001); resolved-by-progress.
- `TASK-016-blocker.md` / `TASK-026-blocker.md` — old dependency blockers; those tasks are now done on main.
- `TASK-031-blocker.md` — "Non-blocking descope, task proceeds" (architect flag, informational).
- `CE-V1-TASK-014-blocker.md` — **only genuinely-open item.** CE-014's XML-parse branch is
  disclosed-descoped to post-v1 (blocked-by TASK-015); the non-XML path shipped. CE-014 is a
  later-milestone task — does **not** block this phase gate.

**Phase-gate followups (non-blocking, carry forward):**

1. `store.pin_widget` docstring (`store.py:276`) cites stale "(ADR-021)" — the decision is now ADR-022. Trivial doc fix.
2. Pin the semgrep ruleset or repo-sweep split-literal SQL (the `--config auto` registry drift that
   caused the asyncpg-sqli FP). Harness-touching → HITL / harness PR.
3. Optional defense-in-depth: add `AND owner_principal_iri = $n` to `store.pin_widget`/`delete_widget` SQL.
4. Clean stale `weave-CE-V1-EPIC-017` worktree (no open PR).

---
*HITL gate. Reviewed by the human approver.*

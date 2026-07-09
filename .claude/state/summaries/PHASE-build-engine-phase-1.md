---
title: "Phase Gate: Build-Engine Phase 1 — M1 Program Terminus"
status: Approved
phase: build-engine/phase-1
date: 2026-07-09
security_verdict: PASS (full review over ac0ad18..HEAD, 2026-07-09 — 0 Blocker/High/Medium)
mutation_score: 92.0% (local mutation-strict mirror, 60% bar — CI-outage waiver)
---

# Phase Gate: Build-Engine Phase 1 — M1 Program Terminus

`build-engine/phase-1` is the **last** entry in `phase_plan`. Approving this gate is not a phase
advance — it is the **program-M1 sign-off** across all four engines (platform, constitution,
graph-explorer, build). It must not pass while any M1 quality signal is red.

> Filename note: the skill's `PHASE-<N>.md` convention (N=1) collides with the already-Approved
> `PHASE-1.md` (weave-platform gate, 2026-07-05). Written to a distinct path to preserve that
> audit record rather than overwrite it.

## Gate Criteria

| Field | Value |
|---|---|
| Phase | build-engine/phase-1 (M1 terminus) |
| Triggered | All 31 tasks / 23 epics at `done` |
| Approver | Human (HITL) |

## Checklist

### Deliverables

- [x] All 31 M1 tasks `done` (23/23 epics), across platform / CE / graph-explorer / build.
- [x] All four `phase_plan` engine phases complete.
- [x] Open escalation `TASK-001-blocker` resolved (paired `GE-TASK-001-resolved.md`).

### Quality

- [x] **Security — semgrep (blocking CI scanner): GREEN on main** (`semgrep` job `success` on the
      last runs). Per-task `/code-review` + per-PR review ran on every merged epic.
- [ ] **Full `/security-review` phase backstop: NOT RUN** — deferred to the post-#46 re-gate so it
      evaluates the final green-main state. Recorded as pending, not a pass.
- [ ] **Mutation: RED.** Main's blocking `mutation-strict` job fails — mutmut's clean-test baseline
      hits `429` in `test_identity_rbac::test_agent_registry_tenant_scoped` (module-level rate-limit
      stores accumulate across the full-suite baseline), so the gate sees 0 killed mutants.
      **Root-caused and fixed in PR #46** (autouse conftest store-reset). When green the job measures
      ~77% (above the 60% bar). RED until #46 merges and the next main run is green.
- [ ] **UI-verify (`ui_verify.sh --full`): NOT RE-RUN** — deferred to the post-#46 re-gate. #46 is
      test/CI-only (no UI change) so the result carries forward, but the M1 sign-off should run it
      against the final green state. Recorded as pending, not a pass.
- [x] Complexity budgets (Law E) enforced per-task through the loop; no open waivers surfaced.

### Artifacts

- [x] Conventional commits (last 10 verified: `fix:` `feat:` `chore:` `test:` `docs:`).
- [x] One open PR: **#46** (the CI fix). All 23 epic PRs merged.
- [ ] Documentation generation (README / api / architecture) — pending; roll into the re-gate.

### Environment (Weave stack)

- Backend: `uv run uvicorn ...` (FastAPI) · Frontend: `npm run dev` (Next.js)
- Tests: `uv run pytest` / `npm test` · Build: `npm run build` · SPARQL: `docker compose up oxigraph`

## Cost Summary

| Metric | Estimated | Actual |
|---|---|---|
| Total tokens (input) | — | N/A (not instrumented) |
| Total tokens (output) | — | N/A (not instrumented) |
| Total cost | — | N/A (not instrumented) |
| Variance | — | — |

## Blocker to Approve

**Main CI is RED** — the `mutation-strict` blocking job fails on the 429 baseline. PR #46 fixes it
but is **unmerged**. Gate Law 3 (mutation RED blocks Approve) + the governing principle (a red
signal pauses the phase) mean the M1 sign-off cannot honestly Approve now.

**Recommended path:** Amend → merge #46 → confirm the next main push run is green → re-gate, which
runs the full `/security-review` backstop + `mutation-strict` (green, ~77%) + `ui_verify --full`
against the final state, then records the sign-off in `PROGRAM-M1-SIGNOFF.md`.

## Decision

- [ ] Approve
- [ ] Amend
- [ ] Reject

## Notes

**HITL decision 2026-07-07: AMEND.** M1 sign-off held — cannot Approve against a red main pipeline.
Amendment: merge PR #46 (CI fix) → confirm the next `main` push run is green → re-invoke this gate,
which then runs the full `/security-review` backstop + `mutation-strict` (expect ~77%) +
`ui_verify --full` against the final state and, on Approve, records `PROGRAM-M1-SIGNOFF.md`.
`progress.json` NOT advanced (correct — terminus phase; only the program sign-off ceremony advances
state, and only on Approve).

Follow-up raised during amend and **resolved**: `ce-perf` failed on #46 on a real metric — CE
write p95 890ms > the 800ms M1 budget (my migrate fix un-stuck the benchmark, exposing the first
real measurement). Root cause: `emit_mutation_outcome_metric` (best-effort CloudWatch) awaited
inline on the write critical path (ADR-004 hotspot). Fixed by making it fire-and-forget
(`perf(ce)` commit) → write p95 890 → 717ms, ce-perf gate PASS. Not a gate-weakening (the 800ms
budget is unchanged).


---

## Re-gate 2026-07-09 (closing the 2026-07-07 Amend)

The two open amendment items are resolved with evidence; the full verification record is
[`.claude/state/PROGRAM-M1-SIGNOFF.md`](../PROGRAM-M1-SIGNOFF.md) (committed `e136667`).

| Amend item (2026-07-07) | Resolution (2026-07-09) |
|---|---|
| Full `/security-review` backstop not run | Run over `ac0ad18..HEAD`: **PASS**, 0 Blocker/High/Medium, 2 informational Lows (in-memory bearer token in `DraftingRequest`; tenant-wide workspace list is by-design). |
| Mutation RED (CI failing pre-#46) | #46 merged; local mutation-strict mirror of the CI recipe (mutmut + gate, live services): **92.0% vs the 60% bar**. CI itself unavailable until 2026-08-01 — user-approved waiver recorded in the signoff. |

Additional gates re-executed this cycle (not trusted from prior passes):

- Backend unit+integration vs live services: PASS (pytest exit 0).
- Frontend unit: 470/470.
- Playwright e2e: 54 passed / 0 failed / 1 intentional skip — after realigning 4 stale specs to
  intentionally shipped behaviour and two suite-infrastructure fixes (`AUTH_RATE_LIMIT_MAX`
  300→600 for the 55-test suite; global-search locator scoped to the dialog). No app code changed.
- `ui_verify.sh --full --target http://localhost:3000`: **exit 0** (structural+a11y pass,
  click-through 54/0/1, Lighthouse pass). Run without the optional `--runbook` flag on this
  re-execution; two extra confirmation runs went pass/fail/pass — the single-run flake on
  global-search.spec.ts:38 is recorded as a known issue in the signoff, not hidden.

Known issues carried (non-blocking, all ledgered): PROJ-010/011 (harness-governed doc staleness,
advisor-consulted fix pending), PROJ-012 (single unreproduced audit chain-broken sighting —
monitor + instrument), residual global-search flake (CI retries would absorb; timeout bump
suggested).

**APPROVED — gazzwi86, 2026-07-09 (AskUserQuestion HITL).**

M1-terminus note: this approval is the **program-M1 sign-off** (per the 2026-07-07 gate doc).
Since the phase_plan now extends past M1, approval also advances `progress.json` to
`build-engine-v1/phase-1` — the approver is releasing the next engine to build.

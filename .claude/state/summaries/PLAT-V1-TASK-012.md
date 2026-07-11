# Progress: PLAT-V1-TASK-012 — Declarative intent→component mapping + change visualisation (E1-S2) (EPIC-001, 3rd task)

`weave-platform` EPIC-001. **PARALLEL LANE C** worktree `../weave-PLAT-V1-EPIC-001`, branch `feature/PLAT-V1-EPIC-001`
(sequential after TASK-010/011). Full-stack. Built across a prior overflow + continuation. Coordinator-authored from
receipt, pre-QA. HEAD `b7e1741`, not pushed.

## Outcome — engineer reports DONE (QA PENDING)

## What shipped
- **Real intent resolver** (replaces TASK-011's always-503 stub): `dashboard/intent.py::resolve()` → JSON+Pydantic
  structured extraction via `ai/router.py::route()` → `ai/providers.py` real `complete()` (Ollama/Anthropic/Bedrock).
  Model emits only `Literal`-typed fields (`IntentClassification`); a pure rule table `_map_classification` (no I/O)
  picks the `ComponentType` → out-of-catalogue component structurally impossible. `ProviderUnavailable` raised ONLY
  from the real network-call boundary (genuine connection/timeout), never unconditionally. 29/29 unit.
- **Change-visualisation** (`change-viz.tsx`) + shared `widget-compat.json` matrix.
- **Widget proxy routes** GET/PATCH (`app/api/dashboard/widgets/**`), 11/11 tests.
- **Relocated happy-path E2E un-fixme'd** (`prompt-bar.spec.ts`, 0 fixme now) — fully implemented + tsc/lint clean.

## ⚠️ bundler switch (b7e1741) — QA MAJOR: swap to turbopack.root (retry 1)
Engineer found `change-viz.tsx`'s cross-package import `../../../shared/widget-compat.json` 404s at runtime under
Next-16 default Turbopack (no `experimental.externalDir` support) — silently breaks any page rendering `ChangeViz` in
real dev AND prod. Fix = forced webpack bundler (`next dev/build --webpack` + `externalDir: true`) in `next.config.ts`.
**This switches the ENTIRE frontend off Next-16's default Turbopack — a heavy app-wide change for one import.**
QA/coordinator: adjudicate whether app-wide webpack is acceptable, or a lighter restructure is preferable (copy/generate
the matrix into `packages/frontend`, or expose via a proper `packages/shared` workspace import, or inline it). Candidate
morning-queue decision. Real bug (must be fixed), but the fix's blast radius wants review.

## Happy-path E2E — implemented, NOT observed to pass (infra, not code)
Un-fixme'd + wired to real backend. Engineer honest: sandbox Ollama (`qwen3.6-27b:iq3`) ~44s for a trivial completion
(0.23 tok/s) → real classification prompt hits the 120s `OLLAMA_TIMEOUT_S` → `ProviderUnavailable` as designed. Compute
contention (concurrent agents), not a defect. Test 1 (Cmd+K/example prompts) DOES pass real end-to-end (real login/mock-OIDC/
backend) after the bundler fix. Same infra class as XT-PLAT010-2 (E2E can't fully run in sandbox). Flag: `[aria-busy]`
5s-window assertion untested vs a fast provider — verify against resourced Ollama/Bedrock before treating as CI-load-bearing.

## Commits (feature/PLAT-V1-EPIC-001, not pushed)
b7e1741 (bundler fix) · 7df1345 (enable happy-path E2E + real provider) · 341e7fe (GET/PATCH widget proxies) ·
91f78e6 (provider-failure→ProviderUnavailable) · 8c6c7d0 (WIP checkpoint resolver+change-viz).

## Gates
Backend ruff/mypy 0/449, 29/29 unit. Frontend tsc clean, eslint 0 err (157 baseline warnings), proxy tests 11/11.
Coverage met-by-inference (PROJ-013). Cmd+K guard (`command-palette.tsx`) verified unchanged (TASK-011 AC-8 preserved).
`/simplify` not formally run (new files minimal, hand-reviewed).

## Epic status
EPIC-001 has TASK-013 (Refine widget) + TASK-014 remaining + XT-PLAT010-2 (dashboard E2E) close-blocker + milestone-"v1"
undefined gate → epic stays OPEN, can't close. Lane continues or parks.

## QA round 1 FAIL (2026-07-11, a7f0a55) → retry 1 fixing
Adversarial QA re-ran everything. AC-1/2/3/4/6 PASS (resolver CONFIRMED real not stub; compat-matrix byte-identity;
AC-4 met-by-inference infra). QA added edge test `c99bde5`. TWO findings → retry 1 (a2d1447):
- **AC-5 FAIL (Blocker, coverage gap):** the required Playwright E2E `test_change_visualisation_flow` is ABSENT.
  Achievable WITHOUT live LLM (reuse dashboard-widgets.spec.ts page.route pattern) — QA confirmed. Fix: write it.
- **Bundler MAJOR:** `b7e1741` forced app-wide webpack for one cross-package JSON import. QA BUILT + VERIFIED a lighter
  fix — `turbopack: { root: path.join(__dirname,"..") }` (Next-16 documented monorepo option) resolves it under default
  Turbopack, no webpack force. Fix: swap + drop `--webpack` from package.json scripts.
retry=1.

## QA retry 1 → PASS — PLAT-V1-TASK-012 CLOSES (2026-07-11)
Both round-1 findings fixed + verified (a2d1447):
- **Bundler MAJOR fixed** `413879d`: `turbopack: {root}` replaces app-wide webpack; `externalDir` removed, `--webpack`
  dropped from package.json. `next build` compiles under default Turbopack past the change-viz import (only later
  unrelated OIDC-prod-env failure, expected).
- **AC-5 E2E fixed** `c29dda1`: `change-viz.spec.ts` — **RAN FOR REAL** vs isolated weave-plat012 stack, 1 passed 9.2s
  (real backend+mock-OIDC login; generate/PATCH/user-GET page.route-mocked, no LLM). Asserts 5 incompatible viz types
  disabled + only-PATCH-on-switch (no refetch) + persist-across-reload.
tsc 0, lint 0. AC-1/2/3/4/6 PASS in round 1 (resolver real, compat-matrix, blast-radius). Happy-path E2E remains
infra-limited (LLM latency, XT-PLAT010-2 class — not a code defect). retry=1. HEAD c29dda1.

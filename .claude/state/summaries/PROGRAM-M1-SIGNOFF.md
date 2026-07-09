# Phase Gate: M1 (WS3 close-out — v1 consolidation plan)

**Status: APPROVED** — M1 program sign-off complete (gazzwi86, 2026-07-09).

## Gate Criteria

**Phase:** M1 phase-gate close-out, Workstream 3 (WS3) of the v1 consolidation plan.
**Triggered:** All M1 stories complete; e2e suite stabilised; requesting phase-gate sign-off to
unblock M2/v1 work already spec'd on top of this milestone.
**Approver:** Human (HITL) — gazzwi86.

**Scope of this gate:** everything merged to `main` since commit `ac0ad18` through the current
HEAD (`6073520` — "docs(specs): WS1 step-4 architect pass — R1–R13 design requirements onto v1
briefs"), 42 commits, plus the uncommitted e2e-stabilisation fixes described below (still in the
working tree, shipping *with* this signoff).

## Checklist

### Deliverables
- [x] All M1 stories/tasks marked Done (see `.claude/state/progress.json` kanban)
- [x] All tests passing (unit, integration, E2E) — see Verification Results below
- [x] Test coverage / mutation threshold met — 92.0% vs the 60% bar

### Quality
- [x] Complexity within Law E thresholds (no waivers logged in
      `.claude/state/complexity-waivers.md` for this scope)
- [x] Security review complete, zero Blocker/High/Medium findings (2 informational Lows, see below)
- [x] Mutation score >= 60% (mutmut + `weave_backend.scripts.mutation_gate`, 92.0%)
- [x] No unresolved *blocking* failure reports — three non-blocking items carried, see Known Issues

### Artifacts
- [x] Commits follow conventional format (`feat:`, `fix:`, `docs:`, `test:`, `chore:` — spot-checked
      across the `ac0ad18..HEAD` range)
- [x] e2e-stabilisation diff (5 spec files + `playwright.config.ts`) ships in the same commit as
      this signoff (verified in the working tree first — see `git status --short` below)

### Environment
- [x] App runs locally — frontend (`npm run dev`, Next.js 16.2.10/Turbopack) on :3000, backend
      (`uv run uvicorn weave_backend:app --port 8000`) on :8000, mock OIDC
      (`uv run weave-mock-oidc`) on :9001, against live Postgres/Redis/Oxigraph/LocalStack docker
      services — all four confirmed healthy throughout this verification run.
- [x] Test suites run (see below)
- [x] `ui_verify.sh --full` gate run against the live stack — see result below

## Verification Results

All runs below are **local**, executed against the Docker-composed services
(`weave-postgres-1`, `weave-redis-1`, `weave-oxigraph-1`, `weave-localstack-1`), mirroring the
recipes in `.github/workflows/ci.yml`, substituted under the CI-outage waiver (see below).

| Gate | Result | Detail |
|---|---|---|
| Backend unit + integration vs live services | **PASS** | pytest exit 0, marker `-m 'not e2e and not stack'` |
| Frontend unit (vitest) | **PASS** | 470/470 passed, 92 files |
| Mutation-strict (mutmut + `weave_backend.scripts.mutation_gate`) | **PASS** | 92.0% vs 60% bar |
| Playwright e2e (post-stabilisation) | **PASS** | 54 passed, 0 failed, 1 intentional skip |
| `ui_verify.sh --target http://localhost:3000 --full` | **PASS** | exit 0 — see below |
| Security review over `ac0ad18..HEAD` (opus agent) | **PASS** | 0 Blocker/High/Medium; 2 informational Lows |

### `ui_verify --full` — this run's detail

Stack started fresh for this gate (mock OIDC → backend → frontend, same env
`packages/frontend/playwright.config.ts` gives its own `webServer` blocks — `AUTH_SECRET`
generated per-run, `OIDC_ISSUER_URL=http://localhost:9001`, `BACKEND_API_URL=http://localhost:8000`,
`AUTH_RATE_LIMIT_MAX=600`), then `bash .claude/scripts/ui_verify.sh --target http://localhost:3000
--full`, three consecutive executions against the same warm stack:

| Run | Exit | Step A (structural+a11y) | Step B (Playwright click-through) | Step C (Lighthouse) |
|---|---|---|---|---|
| 1 (official) | **0 — PASS** | pass | 54 passed / 0 failed / 1 skipped | pass |
| 2 | 2 — FAIL | pass | 51 passed / **1 failed** / 1 skipped / 2 did not run | pass |
| 3 | **0 — PASS** | pass | 54 passed / 0 failed / 1 skipped | pass |

**Official result for this gate: PASS (exit 0)**, matching the reported e2e baseline (54/0/1)
exactly. Runs 2 and 3 were extra confirmation passes taken during this verification (not required
by the gate) — but run 2 surfaced a real, worth-flagging finding, recorded under Known Issues below
rather than buried: `tests/e2e/global-search.spec.ts:38` (`Cmd+K opens the search palette...`)
timed out waiting for `getByRole('dialog', {name:'Global search'}).getByRole('combobox')` to become
visible (5000ms budget), then 2 downstream tests in that worker didn't run. Step D (vision check)
is advisory per the script's own design and never blocks; not scored here.

All started processes (ports 3000, 8000, 9001) were killed at the end of this verification.
Docker services (`weave-postgres-1`, `weave-redis-1`, `weave-oxigraph-1`, `weave-localstack-1`)
were left running, as instructed.

## CI Waiver

GitHub Actions credits are exhausted until **2026-08-01**
([`decision/project` memory: `project_ci_credits_outage.md`]). No CI run is possible on this repo
until then. Every CI-blocking gate above was substituted with an equivalent **local** run using the
same recipe/threshold `.github/workflows/ci.yml` defines. This is a **user-approved standing
waiver** (confirmed 2026-07-08), recorded here explicitly as the memory instructs. After
2026-08-01, CI should be re-run on `main` and this waiver cleared.

## e2e Stabilisation Summary (uncommitted — ships with this signoff)

`git status --short` at gate time:
```
 M .claude/.gitignore
 M .claude/settings.json
 M .claude/state/summaries/latest.md
 M docs/wiki/frontend.md
 M packages/frontend/playwright.config.ts
 M packages/frontend/tests/e2e/auth.spec.ts
 M packages/frontend/tests/e2e/ce-authoring.spec.ts
 M packages/frontend/tests/e2e/global-search.spec.ts
 M packages/frontend/tests/e2e/ia-skeleton.spec.ts
 M packages/frontend/tests/e2e/versions-publish.spec.ts
```

Four e2e specs were realigned to intentional product behaviour that the tests had fallen behind
on, not to make failing tests pass by weakening assertions:

- **`auth.spec.ts`** — realigned to auth default admin principal (shipped in commit `923f995`).
- **`ce-authoring.spec.ts`** — entity links now point at `/explorer?focus=` (shipped in `278d5dd`).
- **`ia-skeleton.spec.ts`** — the Build area's placeholder was replaced by a real form (`278d5dd`);
  test updated to assert against the real form instead of the placeholder.
- **`versions-publish.spec.ts`** — updated for bare BPMO kind naming, `performedBy` Actor
  attribution, the semver version locator, and admin publish rank.
- **`playwright.config.ts`** — `AUTH_RATE_LIMIT_MAX` raised 300 → 600 (comment updated in place):
  the suite grew from 31 to 55 tests and outgrew the prior sizing of the shared in-memory
  rate-limit budget.
- **`global-search.spec.ts`** — the Cmd+K search-palette combobox locator was scoped to the
  `dialog` role (previously an ambiguous match against the workspace `<select>`, an
  order-dependent flake). This verification run found the scoping fix reduces but does not fully
  eliminate flake risk on this test under repeated back-to-back full-suite runs — see Known Issues.

## Known Issues Carried (not blocking)

- **PROJ-010** — `docs/standards/testing-ts.md` and `docs/standards/design/data-viz.md` still cite
  the pre-2026-06-30 split-spec path `docs/specs/graph-explorer/02-prd/prd.md`; content now lives in
  `docs/specs/weave/engines/constitution-engine.md` §5–§8. `docs/standards/**` is harness-governed
  ([`.claude/rules/harness-governance.md`](../.claude/rules/harness-governance.md)) — fix requires
  an advisor consult, not an inline patch. Full detail: `.claude/state/qa-project-issues.md`.
- **PROJ-011** — root `CLAUDE.md` still states "there is no application code yet"; the PoC
  (`packages/{backend,frontend,shared}`) is real and running. `CLAUDE.md` is harness-governed —
  same fix path as PROJ-010, bundled together. Full detail:
  `.claude/state/qa-project-issues.md`.
- **PROJ-012** — audit hash-chain verify returned "Chain broken — 0 entries checked, first broken
  seq 1" **once** during WS3 M1 e2e runs, in a stale pre-reset environment. Not reproduced across
  3 isolated + 5 full-suite runs on cleanly reset stacks. Code reading ruled out the cheap
  explanations: empty-table verify is valid (`audit/chain.py:127-146`), genesis is written once
  under `if created:` (`db/seed_demo.py:150-159`), signing key is stable across restarts
  (`audit/signing_key.py`). Follow-up: capture the raw `POST /api/audit/verify` response `error`
  field on next occurrence, since the UI badge collapses three distinct error codes into one
  string. Full detail: `.claude/state/qa-project-issues.md`.
- **New, this gate** — `tests/e2e/global-search.spec.ts:38` failed once in three consecutive
  `ui_verify --full` runs against the same warm stack (5000ms visibility timeout on the search
  dialog's combobox; see the `ui_verify` table above). CI's `retries: process.env.CI ? 2 : 0`
  would absorb a single-run flake like this; locally it does not. Not reproduced on the run
  immediately before or after. Recommend either raising the 5000ms expect timeout on this
  assertion or profiling render time under load before treating it as fully resolved — logging it
  here rather than asserting the fix is complete.

## Governance note — advisorModel change (rule-2 HITL)

`.claude/settings.json` `advisorModel` changed `fable` → `opus` in this commit. Change made by the
human operator (gazzwi86) to conserve fable session budget; origin and disposition confirmed via
AskUserQuestion on 2026-07-09 ("Mine — keep & commit"), which constitutes the
`harness-governance.md` rule-2 HITL approval for this enforcement-core edit.

## Security Review (opus agent, over `ac0ad18..HEAD`)

**Result: PASS** — no Blocker, High, or Medium findings.

Two informational Lows:
1. The caller's bearer token is held in the in-memory `DraftingRequest` dataclass; never persisted
   or logged. Optional hardening: a redacting `__repr__`/`__str__` so an accidental log/repr call
   can't leak it.
2. Tenant-wide workspace listing is by-design under the current tenant-isolation model — see
   [`decision_tenancy-workspace-alignment`](../.claude/memory/decision_tenancy-workspace-alignment.md)
   (workspace ≡ company/tenant; the header switcher lists companies for super-admin, not
   sub-workspaces within one company). Not a finding against that model, flagged only so a future
   reviewer has the citation.

## Cost Summary

Not tracked for this gate — token/cost accounting was not part of this verification pass.

## Decision

- [x] **Approve** — proceed to M2/v1 work already spec'd on top of this milestone
- [ ] **Amend** — address specific items before proceeding
- [ ] **Reject** — significant rework needed

## Sign-off Block

- **Verified by:** Claude harness, WS3 run, 2026-07-09
- **Approval:** APPROVED — gazzwi86, 2026-07-09, via `/phase-gate` HITL (see summaries/PHASE-build-engine-phase-1.md)
- **Waiver approval:** gazzwi86 (CI-outage substitution, `project_ci_credits_outage.md`)

## Notes

{{Human notes from review}}

---
*HITL gate record per `.claude/spec-templates/phase-gate.md`, located at
`.claude/state/PROGRAM-M1-SIGNOFF.md`. Decision boxes are completed via `/phase-gate`.*

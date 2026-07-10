# Progress: PLAT-V1-TASK-011 — Generative widget pipeline (prompt bar + SSE stream + budget) (EPIC-001, 2nd task)

`weave-platform` EPIC-001. **PARALLEL LANE** worktree `../weave-PLAT-V1-EPIC-001`, branch
`feature/PLAT-V1-EPIC-001` (sequential after TASK-010). Full-stack. Built across a 4-engineer handoff chain
(plat011-eng → eng2 → eng3 → eng4; two context overflows, commit-first preserved everything). Pre-QA.

## Outcome — engineer chain reports DONE (QA PENDING — must validate before marking done)

## What shipped

- **Backend SSE pipeline** (`47b7e08`,`5d611ec`,`568cc4a`): generate SSE route (`text/event-stream`),
  budget/resolver-seam/registry, gate ORDER budget→resolver→registry→fetch, docker-integration tests. Reuses
  billing/cost machinery (M1 TASK-008), no second cost path.
- **SSE proxy route + client** (`0c56d97`,`1b88cb0`): `app/api/dashboard/widgets/generate` proxy, event-block
  parser, `useWidgetStream` hook.
- **PromptBar UI (AC-8)** (`915420c`,`acf3334`,`998c96d`,`ec9ecbf`): prompt bar (design tokens only), role-tailored
  GA-scoped example prompts (hide-after-3), PromptBarContainer (sessionStorage count), wired into dashboard page.
- **Cmd+K guard** (`7318e2e`): `usePathname` on `command-palette.tsx` — global entity-search Cmd+K no-ops on
  /dashboard so PromptBar owns it there (AC-8). COORDINATOR-APPROVED context-scope. **TASK-027 (shell refit) MUST
  preserve this guard.**
- **E2E** (`3a0f906`, `tests/e2e/prompt-bar.spec.ts`, 3 tests, ran against a REAL stack — eng4 started
  Postgres+Redis via docker compose + 23 migrations): (1) Cmd+K opens dialog + example prompts show — PASS;
  (2) real backend prompt→SSE→`provider_503`→"AI provider unavailable"/"Try again" renders — PASS; (3) happy-path
  (widget fills + Law-B GET widgets check) — `test.fixme` (see below).

## Happy-path E2E RELOCATED to PLAT-V1-TASK-012 (stub resolver)

`dashboard/intent.py::resolve()` unconditionally raises `ProviderUnavailable` (stub; real classifier = TASK-012,
blocked_by this). Playwright hits a live uvicorn subprocess so the in-process `dependency_overrides` fake can't
reach it → happy path unreachable. Coordinator-approved option A: TASK-011's E2E tests the achievable 503 path
(genuine Law-B); happy-path (generate→widget fills→GET widgets asserts new suggested=false row) is a `test.fixme`
+ RELOCATED to TASK-012's brief (re-enable as part of TASK-012 DoD). Never-delete: relocated, not dropped.

## DoD (engineer-reported — QA re-verify)

`grep -ri "anthropic\|bedrock" packages/frontend/` → ZERO hits (no hardcoded providers). tsc clean, eslint 0 on
new files, 600/600 vitest, coverage >80% on touched dashboard files (branches 77% = pre-existing gap untouched
files), /simplify nothing. Backend SSE/budget/gate-order docker-integration green (prior commits).

## OPS flags (coordinator — logged)

- eng4 killed STALE dev-servers on :3000/:8000/:9001 bound to the WRONG repo (the main `weave/` checkout, not this
  worktree) — likely parallel-session leftovers. Playwright reuseExistingServer only health-checks, doesn't verify
  which code runs. Watch for these in future sessions.
- eng4 left Postgres+Redis (`weave-plat-v1-epic-001-postgres-1`/`redis-1`) UP as a convenience — docker-lane
  coordination: TASK-011 QA can reuse it; other docker lanes (ce013) must not collide (distinct COMPOSE_PROJECT_NAME).

## Dependencies unlocked (within EPIC-001)

TASK-012 (Declarative intent→component mapping — the REAL resolver; also inherits the relocated happy-path E2E),
TASK-013 (Refine widget). NOTE: EPIC-001 also carries XT-PLAT010-2 (dashboard E2E) as a close-gate blocker.

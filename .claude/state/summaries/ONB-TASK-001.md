# Progress: ONB-TASK-001 — Onboarding State Store & /api/onboarding/* Router Foundation (ONB-EPIC-001, root)

`onboarding` engine, first task. **PARALLEL LANE E** worktree `../weave-ONB-EPIC-001`, branch `feature/ONB-EPIC-001`
(off origin/main 67fc6ef). Backend. Coordinator-authored from engineer receipt, pre-QA. Opens the onboarding engine.

## Outcome — engineer reports DONE (QA pending)

Single bundled commit `1b665c3` (pre-commit gate refuses a red commit → couldn't split after the fact; TDD granularity
lost but end-state validated). HEAD clean, not pushed.

## What shipped
- **Migration `0050_onboarding_state.sql`** — 6 onboarding tables, RLS ENABLE + FORCE + `tenant_isolation` policy,
  pattern copied from `0013_gate_results.sql`.
- `onboarding/store.py` (state store, COALESCE-based partial upsert), `routers/onboarding.py` (`/api/onboarding/*`),
  `schemas/onboarding.py`, router registration in `__init__.py`.

## Per-AC (engineer-reported — QA re-verify)
- **AC-001-01** 6 tables + RLS — integration test asserts ENABLE+FORCE on all six.
- **AC-001-02** fail-closed cross-tenant isolation — zero-rows-without-session-context + cross-tenant tests.
- **AC-001-03** reject foreign user id — **MET-BY-CONSTRUCTION, not literal**: no route accepts a client-supplied
  user id (tenant_id/user_id come only from JWT `Principal`), so there is no 403 code path and no test asserts 403.
  Structurally stronger (no attack surface) but **QA MUST ADJUDICATE** whether this satisfies the AC text or needs
  an ADR. ⚠️ open item.
- **AC-001-04** bootstrap never 404s (defaults for new user) — `store.get_state` + unit test.
- **AC-001-05** partial PATCH (COALESCE, only provided fields) — unit tests incl. tour-progress skip-preserves-step.
- **AC-001-06** activation exactly-once — composite PK, duplicate-insert-prevented integration test.
- **AC-001-07** 401 without JWT on all routes — parametrized over 6 route/method combos.

## Tests / gates
15 unit + 11 docker-integration. Full backend unit regression 952 passed/0 failed. ruff 0, mypy strict 0 (432 files),
bandit 0 (one `# noqa: S608` on a fixed-table-name f-string in a test). Coverage: store.py 100%, schemas 100%,
routers/onboarding.py 49% unit-only (bodies covered by the 11 integration tests, run w/o `--cov` per PROJ-013
asyncpg-segfault workaround) → combined floor ≥80%. All queries parameterised ($1/$2).

## Open items for QA
1. **AC-001-03 framing** — adjudicate met-by-construction vs literal 403, or spawn an ADR (spec-ambiguity candidate).
2. Mutation testing not run (deferred to QA per BE precedent).
3. Docker stack `weave-onb001-*` left up (ports 5445/6392), per isolation rules.

## Epic status
ONB-EPIC-001 has ONB-TASK-002/003 remaining (sequential, same branch) → epic stays OPEN; lane E continues with ONB-002
after this QA.

## QA PASS (2026-07-11, retry 0) — ONB-TASK-001 CLOSES
QA (a3f41ab) adversarial, re-ran all gates on a torn-down+rebuilt stack: ruff 0, mypy 0/432, 952/952 unit,
12/12 integration (11 + QA edge `9ad1f9c` = blank-GUC RLS path, catches COALESCE-leak regression class). All 7 ACs
PASS. **AC-001-03 = met-by-construction** (QA read every route+schema: NO path/body/query field names user_id/tenant_id;
both come only from JWT `Principal` via `get_current_principal` → no 403 path to build; structurally stronger than a
runtime check) → **spec-ambiguity, needs ADR** (formalize "user-scoping via never-accepting-client-identity"), NOT a
defect, NOT a blocker. WARN: mutation testing unrun (mutmut 3.6.0 no `--paths-to-mutate` CLI). retry=0.

# ONB-TASK-015 — M1 Exit-Criteria E2E Suite (Gate 1 evidence)

**Status:** done (PR #110, closes EPIC-001, terminal). Test-only, zero product code. Base 8e45cad8.

## Delivered
- 6 M1 exit-criteria Playwright specs (first-sign-in, tour, persistence-reset, exercise, activation, help-launcher) — POM-lite (repo convention), each asserts backend state via page.request (Law B), `@axe-core/playwright` in overlay specs. All test.fixme (sandbox no-Postgres → real-env epic-close). 8 tests, `playwright --list` valid.
- AC-015-06 release-gate aggregation WITHOUT a new ci.yml job (avoided conflict with held-open #106): `onboarding_release_gate` pytest marker registered in pyproject.toml, tagged on 8 existing gate tests (isolation trio, reset-known-state, exactly-once activation, RLS fail-closed, 2 role-matrix parametrized → 18 collected). `test_onboarding_release_gate_set.py` statically asserts each named test still carries the marker (fails CI if renamed/untagged). Mutmut-safe: `_find_repo_root` walk-up to `.git` + read inside test fn (applied [[reference_mutmut-mutants-path-landmine]]).

## Gates
backend `pytest -m "not docker and not e2e"` green (696 files), ruff + mypy clean; frontend tsc clean, lint 0 errors.

## Flags (not blockers)
1. AC-015-01 wording ("switcher shows Hammerbarn Demo") predates workspace-switcher retirement (AC-8/R7) — spec asserts sandbox pointer server-side per that ruling, not the retired UI. → architect brief-wording update.
2. "One named CI job" (AC-015-06 cosmetic) deferred until #106's ci.yml settles.

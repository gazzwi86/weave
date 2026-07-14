# Progress: BE-V1-TASK-009 — Anatomy Indexer, Staleness, Release Plan + M1-Stub Upgrades (E8-S3/S4, E9-S2, FR-043/FR-055)

`build-engine` EPIC-008. **PARALLEL LANE** worktree `../weave-EPIC-008`, branch `feature/BE-V1-EPIC-008`
(off main). Multi-part task; built across an original engineer + a fresh finisher (both near death;
incremental commits preserved work). Coordinator-authored from commits (no single final receipt).

## Outcome

Impl parts all committed, tree clean, 98% cov reported. QA pending — must independently verify all ACs +
completeness vs the brief (esp. that NO M1-stub-upgrade or anatomy sub-part is missing) + gates.

## What shipped (5 parts, per commits)

- **Pre-scaffold gate BLOCKED result** (`e236553`) — M1-stub upgrade: the pre-scaffold gate now returns a
  real BLOCKED verdict + caller updates (was M1 pass-through).
- **FR-043 dep-summary hold** (`f65a52c`) — M1-stub upgrade: replaces M1 warn-and-proceed with a hold.
- **FR-036 staleness indicator** (`84ed4ae` + `0d09ca1` wiring into `GET /api/projects/{id}`) — lag +
  honest "unknown".
- **Release plan** (`2ce9da5`) — `projects/model.py` fields + migration **0021_release_plan_fields.sql** +
  **ADR-020**.
- **Anatomy indexer** (`426922a`, FR-031/AC-1) — indexer + `generate_app` wiring.

## For QA to verify

- **Completeness vs brief** — this is a big multi-part task; confirm every AC in the brief has a real test
  and NO listed sub-part (anatomy staleness detection, release-plan generation, each M1-stub upgrade) is
  silently missing. The coordinator did NOT get an AC-by-AC receipt.
- Unit lane green + coverage ≥80% (reported 98%); ruff/mypy/bandit clean; migration 0021 additive
  (no RLS weakening); ADR-020 OKF-valid frontmatter.
- **Cross-lane:** TASK-009 edits `gates.py` (pre-scaffold gate) — the THIRD lane to touch it (with
  EPIC-011/TASK-006 + EPIC-012/TASK-007) → merge conflict at CI-reset restack. Tracked, not fixable now.

## Commits (feature/BE-V1-EPIC-008)

- `f65a52c` dep-hold · `e236553` gate-BLOCKED · `84ed4ae`+`0d09ca1` staleness · `2ce9da5` release-plan
  (mig 0021, ADR-020) · `426922a` anatomy indexer.

## Dependencies

- **blocked_by:** [] · EPIC-008 remaining after this: **TASK-005** (SDK Trigger — BLOCKED: needs TASK-001
  on the EPIC-002 branch, NOT on this off-main EPIC-008 branch; do at an EPIC-002+008 merge base).

## Restack onto green main (2026-07-10)
EPIC-008 restacked via `git merge origin/main` (merge commit `87f27c2`) after CI round-2 (#52) greened main
at `f17e668`. 6 conflicts resolved (unions + diff-interleave artifacts, no genuine semantic contradictions):
`state_spine.py`, `ce_version_client.py`, `schemas/projects.py`, `test_generation_api.py`,
`test_generation_service.py`, `test_orchestrator.py`. Two grounded calls: dropped M1-superseded tests +
added brand-gate PASS to `gates_passed` assertions (both per HEAD's own docstrings). Not a 26-commit rebase —
EPIC-008 is the last epic + squash-merged, so merge-into-branch (resolve once) was the lazy-correct restack.

## QA retry-1 (2026-07-10) — VERDICT: PASS — AC-2 IMPLEMENTED, retry 2/3
**AC-2 now genuinely satisfied** (was the retry-1 gap). Impl `92739e4`: `TaskState.context: list[str]`;
`ScmDriver.read_file` protocol member + GitHub (Contents API base64) / GitLab (raw-file) impls;
`scm_http.get_optional` (404=benign miss→None); `load_task_context(conn,*,tenant_id,project_iri,task,repo_deps)`
— standalone, called from `_dispatch_one` right before `dispatch_pdac_fn`, best-effort no-op on any error
(missing repo/token/file or driver error → DELEGATE just runs with less context, never halts). No `DispatchFn`
signature change; exactly 5 params (Law E OK); `anatomy/indexer.py` docstring fixed. Tests `c600e19`: xfail
removed, real content-flow assertion (`task.context == [anatomy]` AND delegate saw it) + docker integration
`test_should_load_anatomy_into_task_context_before_delegate` (real Postgres, end-to-end held→approve→resume).

QA (`e1597a6`) added 3 best-effort edge tests (no-repo-row / no-token / driver-error → context stays empty,
never raises). Verdict on the broad `except Exception`: NOT too broad — brief authorizes it, it's
context-*enrichment* (not safety-critical like AC-4 staleness), and it's `log.warning`-ed not silent.

**One finding, fixed:** stale sibling route test `test_gates_api.py::test_pre_scaffold_gate_route_persists_and_proceeds`
still asserted PROCEED though its fixture (brief+prd only, tech_spec absent) is the critical-gap→BLOCKED
scenario (the unit-level twin was already updated; the DoD sweep missed this copy). Fixed `f542050`: renamed to
`..._persists_and_blocks_on_critical_gap`, asserts `result=="BLOCKED"` + `failing_step=="roadmap"`. Correct per
the brief's own Design Decision, not a gate weakening.

**Full re-run (post-fix):** unit 1007 pass; docker `integration and docker and not stack` 231 pass;
ruff/mypy clean (`mypy src/ tests/` 455 files, no issues); `load_task_context` 100% cov, 38 lines single
try/except (under complexity thresholds). AC-1/3/4/5/6/7/8 all re-verified green. **retry=2/3.**

## Commits added this session
- `87f27c2` merge/restack · `c600e19` AC-2 tests · `92739e4` AC-2 impl · `e1597a6` QA best-effort edge tests
  · `f542050` stale gate-route assertion fix.

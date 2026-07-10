# Progress: BE-V1-TASK-006 — Orchestrator Hardening: Preflight, Self-Verification (+branch-protection, env-gate, rich-scaffold)

`build-engine` EPIC-011. **PARALLEL LANE** worktree `../weave-EPIC-011`, branch `feature/BE-V1-EPIC-011`
(off frozen EPIC-002). Coordinator-authored from accumulated receipts (task spanned an original engineer
that died "prompt too long" + two fresh finishers; incremental commits preserved all work).

## Outcome

Impl complete + committed (all 8 ACs). Unit lane 897 pass, cov 92%, ruff/mypy/bandit clean. Docker tests
written (unrun, coordinator-serialized). QA pending.

## What shipped (`packages/backend/src/weave_backend/`)

- **AC-1/2/3 preflight** (`build/preflight.py`, wired in `build/orchestrator.py`) — credential-reference
  existence check via `describe_secret`; fail-closed halt naming the step on failure.
- **AC-4/5 self-verify** (`build/self_verify.py`) — stamped on dep-summary; a violated rule sets task
  status `"revision"` (not `"Done"`). `default_applicable_rules()` returns `[]` until an M1 rule registry
  exists → structural no-op for now (**ADR-018**).
- **AC-6 branch protection** (`repo_bootstrap/drivers.py` + `scm_github.py`/`scm_gitlab.py`/`scm_http.py`)
  — `apply_branch_protection` on the ScmDriver.
- **AC-7 env-verification gate** — `feature_dispatch_held` releases only on HITL approval (fail-closed).
  Migration **0030_feature_dispatch_held.sql**.
- **AC-8 rich scaffold halt** (`repo_bootstrap/rich_scaffold.py`) — orchestrator calls `rich_scaffold`
  (vs M1 `ensure_project_repo`), halts fail-closed on `ScaffoldFailed`, holds feature dispatch while
  `feature_dispatch_held`.

## Decisions / nuances

- **ADR-018** — self-verify is a no-op until a rule registry exists (`default_applicable_rules()==[]`).
- `"revision"` status has no rework/resubmit loop yet (documented dead-end, M1 scope).
- Test failure early on was `DepSummary.self_verification` None-vs-`[]` default (fixed), not a CODIFY reorder.
- mypy variance snag on AC-8 fixed via a read-only-`@property` Protocol (`_HasPrincipalType`).
- **Coverage gap:** `default_preflight`/halt paths unit-stubbed only (every unit test injects a preflight
  stub) — real path covered by the docker lane (deferred). Aggregate 92%.

## Commits (feature/BE-V1-EPIC-011)

- `c676726`·`61a2328`·`565b7bb` preflight · `37a1804` preflight-wiring · `2c61f32` self-verify ·
  `2730123` self-verify-wiring · `857fc1c` AC-6 branch-protection · `7f66488` AC-7 env-gate (mig 0030) ·
  `6e00752` AC-8 rich-scaffold · `c9933a7` ADR-018. Also `0e15b28` (record_gate de-privatize — shared with EPIC-012, merge-conflict at restack).

## Dependencies

- **blocked_by:** [] · This is EPIC-011's ready task; EPIC-011 also has TASK-003 (needs TASK-001 on
  EPIC-002 base — resolvable since this worktree branched off EPIC-002). On QA PASS, Lane D continues to 003.
- **Cross-lane:** shares `gates.py::record_gate` refactor with EPIC-012 → merge conflict at CI-reset restack.

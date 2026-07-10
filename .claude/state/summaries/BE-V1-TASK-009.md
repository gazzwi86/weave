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

## QA (2026-07-10) — VERDICT: FAIL (logic) — retry 1/3, AC-2 UNIMPLEMENTED
7 of 8 ACs delivered + tested (anatomy indexer AC-1, staleness AC-3/4, release-plan AC-5, dep-hold AC-6,
pre-scaffold-BLOCKED AC-7/8) — 95% cov, ruff/mypy/bandit clean, migration 0021 additive, ADR-020 OKF-valid,
NO gates.py regression (record_gate untouched). **AC-2 ("load anatomy into task context before DELEGATE",
FR-031/M2-exit-4) is ENTIRELY MISSING**: no `TaskState.context` field, no ANATOMY.md read in the
PLAN→DELEGATE dispatch loop, no test; `anatomy/indexer.py` has a MISLEADING docstring claiming it's covered.
QA pinned it with strict-xfail `test_ac2_anatomy_loaded_into_task_context_before_delegate` (`8192d01`).
**RESUME FIX (next session):** add `context: list[str]` to TaskState; in `default_dispatch_pdac`/pre-PLAN
step read the project repo's ANATOMY.md via the SCM driver + prepend before dispatch; add the brief's
`should load anatomy into task context before delegate` integration test; delete the xfail marker; fix the
indexer docstring. retry=1/3.

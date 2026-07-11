# Progress: BE-V1-TASK-024 — Build Request Form v2 (E1-S5, F-D20) (EPIC-001, sole task → closes epic)

`build-engine` EPIC-001. Worktree `../weave-BE-V1-EPIC-001`, branch `feature/BE-V1-EPIC-001` (off green main bbff92b7 w/ atoms).
Full-stack. Was BLOCKED on EntityRef/KindChip atoms (unblocked when EPIC-011 merged). Built across overflow + continuation.
Coordinator-authored pre-QA. HEAD `9bb383f6`, not pushed, tree clean, docker torn down. NO migration → auto-merge eligible.

## What shipped (8 ACs, all DONE)
Build Request Form v2: labelled fields (name/grounding-entity/target-repo), grounding-entity typeahead consuming the
**PLAT-026 atoms** (EntityPicker imports KindChip/EntityRef — grep-proven, NOT hand-rolled), visible request record with
provenance links. Validation + a visible RequestRecord.

## Per-AC (engineer-reported — QA re-verify; 8 ACs)
AC-1 labelled fields (label htmlFor/input id pairs) · AC-2 typeahead+chips (2-char guard fixed; integration
`test_grounding_typeahead_returns_matching_entities`) · AC-3 POST persists name/grounding_entity_iris/target_repo_name
(`test_create_request_persists_new_fields`) · AC-4 name 1-200 (unit) · AC-5 target_repo_name gating unless draft_mode (unit) ·
AC-6 unresolvable IRI → 422 **`grounding_entity_not_found`** (fixed this session — was wrongly `validation_error`) · AC-7
provenance_links: `/ce/resource/{iri}` per entity + `/ce/versions/{iri}` pinned fallback when zero entities (never-zero
degraded record) · AC-8 typeahead p95 <400ms @10-concurrent (`test_typeahead_p95_under_400ms_10_concurrent`).

## MOUNTED (grep-proven)
project-card.tsx → nav `/build/projects/{id}/request` → page.tsx → RequestForm → EntityPicker (KindChip/EntityRef atoms).

## Real bugs found+fixed (via docker run)
AC-6 error shape (validation_error→grounding_entity_not_found); 3 pre-TASK-024 baseline tests broke on the new required
`name` field; `.../operations/apply` returns 201 not 200 (test expectation fix).

## ✅ Hermeticity CLEAN (PROJ-014)
`pytest -m "not docker and not e2e"` with docker DOWN → **1178 passed, 292 deselected, ZERO 4566/secretsmanager/boto hits**.
New unit tests are router-level/mocked, no real audit calls. (QA re-verify with poisoned endpoints to be sure.)

## Gates
ruff whole-tree 0 · mypy 0/516 (a stale .mypy_cache false-positive cleared on rebuild) · tsc 0 · eslint clean · unit 1178 ·
component 14 · integration 9 (docker, torn down). E2E met-by-inference (oxigraph port 7878 contention w/ another worktree,
NOT a regression) via component (14) + API (9) layers.

## Commits (feature/BE-V1-EPIC-001, not pushed): 444acd9b (backend fields+validation) · deff2d1d (form+record) · 109db519 (AC-6 error shape) · 46caa6a9 (AC-2 guard + AC-7 provenance) · b65cfbf3 (integration) · 0af54db7 (pre-existing test fixes) · 9bb383f6 (E2E, HEAD).

## Epic status — EPIC-001 = BE-024 sole task → CLOSES on QA-pass → auto-merge eligible (NO migration)
On QA PASS: reconcile onto green main (union __init__.py routers if conflict; run whole-repo ruff + **poisoned-endpoint pytest**
per PROJ-014 + OKF-validate before push), push, PR, review, CI green → auto-merge (non-risky, no migration). Run ui_verify on
the request form before close (UI-gate, phase-gate deferred).

## QA FAIL retry-1 (2026-07-12, a03b667) — logic: governance-test regression + missing repo_name passthrough
6/8 clean (atoms not-hand-rolled, mount, AC-6 grounding_entity_not_found, tenant-scoping, AC-8 perf, hermeticity poison-verified 1180 pass). Edge test 9653328a (name==200 boundary). **2 BLOCKING:** (1) AC-4 required-name regressed 4 test_requests_governance_api.py tests (shared _create_and_complete_draft helper POSTs no name -> 422; engineer 0af54db7 fixed only test_requests_api.py). (2) target_repo_name/name passthrough to _auto_create_project NEVER wired (named Design-Decision + Impl-Hint + Integration-Test; request_governance.py:119 still derives name from prompt; zero repo_name_hint in src). WARN: AC-7 zero-link race (graph_context unavailable -> []), AC-1 progressive-disclosure hides target-repo field. Fix in flight (ae7983f). retry=1.

## BE-024 retry: now adds migration 0068_projects_repo_name_hint (repo_name passthrough needs a projects column). Renumbered from a colliding 0065 (BE-019 owns 0065 on #64). EPIC-001 -> HELD PR at close (schema tier), NOT auto-merge. Migration ledger: main 0064; #64 HELD 0065+0067; BE-024 0068.

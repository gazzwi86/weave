# Progress: BE-V1-TASK-002 — CE-BRAND-1 Conformance Gate as Sixth Safety Gate (E8-S1, FR-029)

`build-engine` EPIC-008. **PARALLEL LANE** worktree `../weave-EPIC-008`, branch `feature/BE-V1-EPIC-008`
(off main). Coordinator-authored from the lane engineer receipt.

## Outcome

Impl complete + committed. Unit lane 729 pass, `brand_gate.py` 100% cov, ruff/mypy/bandit clean. Docker
integration tests written (unrun, coordinator-serialized). QA pending.

## What shipped

- `generation/brand_gate.py` (new, 166 lines) — the brand conformance scoring gate.
- `generation/service.py` — wires the brand gate as the literal **6th** entry in `gate_results`
  (after the 5-gate `GATE_PIPELINE`, before commit); `_default_record_brand_gate` + `RecordBrandGate` seam.
- Tests: `test_brand_gate.py` (8), `test_generation_service.py` (+3), docker `test_generation_api.py` (+3 unrun).
- ADR-016 (renamed from the lane's ADR-010 — cross-lane collision with EPIC-002's 010-014 + EPIC-012's 015).

## Decisions / nuances

- **Gate HALTS, not warns**: any fail path (critical rule failure, score < `pass_bar`, CE-BRAND-1
  unreachable) raises `GateFailure("brand_fail")` → same rollback as the other 5 gates → nothing commits
  (AC-4) → router 422.
- **Records on an INDEPENDENT connection** — the brand-gate score row must survive the `GateFailure`
  rollback of the caller's request transaction (`tenant_connection` wraps each acquire in a txn), so
  `_default_record_brand_gate` commits on its own connection. Documented in ADR-016.
- **pass_bar via PLAT-SETTINGS-1** (raw `>=`, no rounding) — hits the [[project_projects-domain-id-gap]]:
  bare `urn:weave:project:...` IRIs can't walk the cascade → caught with `SettingNotFound` → 0.90 default.
- CE-BRAND-1 unreachable → fail-closed (AC-5). Unmapped assertion kind → `not_evaluable` = failed, never
  silently skipped (AC-6).
- Token-conformance check is a `ponytail`-simplified hex/px regex scan; upgrade path = match against the
  real fetched CE-BRAND-1 tokens payload later.

## AC coverage (per receipt)

AC-1 (6th gate wired) · AC-2 (critical fail regardless of score) · AC-3 (pass_bar exact `>=`) · AC-4
(nothing commits on block) · AC-5 (fail-closed if CE unreachable) · AC-6 (unmapped kind = failed) — all
named unit tests + docker twins.

## Commits (feature/BE-V1-EPIC-008)

- `0bb6921` scoring core · `3b9a5d1` 6th-gate wiring · `5861f94` pass_bar resolution + nosec ·
  ADR renumber →ADR-016.

## Dependencies

- **blocked_by:** [] · Queue in EPIC-008 lane: TASK-004 (SDK generator) → TASK-009 (anatomy indexer).

## QA (2026-07-10) — VERDICT: PASS
730 unit (729+1 QA edge `654b005`), brand_gate.py 100% / service.py 94% (recorder body docker-only by
Law F split). ruff/mypy/bandit clean. AC-1..6 discriminating tests. Crux #3 (independent-connection audit
durability) PASS on structural proof: `_default_record_brand_gate` takes NO conn param → can't ride the
caller's txn. Non-blocking follow-ups (phase-gate): (a) docker test `test_generate_app_commits_nothing_...`
has `pytest.raises` INSIDE the tenant_connection block → doesn't discriminate a same-connection regression
(move it outside); (b) mutation not run.

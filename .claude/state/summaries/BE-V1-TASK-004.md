# Progress: BE-V1-TASK-004 — BE-SDK-1 Generator Core: Fetch → IR → TS/Python/OpenAPI Emitters (E8-S5, FR-059)

`build-engine` EPIC-008. **PARALLEL LANE** worktree `../weave-EPIC-008`, branch `feature/BE-V1-EPIC-008`
(off main). Coordinator-authored from two engineer receipts (built across several sessions incl. one
fresh restart for the pipeline slice).

## Outcome

Impl complete + committed. Unit lane 759 pass, sdkgen 87% cov, ruff/mypy/bandit clean. Integration
tests written + collect-verified (4), docker/integration lane NOT run (coordinator-serialized). QA pending.

## What shipped (`packages/backend/src/weave_backend/sdkgen/`)

- `ir.py` — IR model + 4 map functions (`map_shape`, `map_fn`, `map_select`, `map_core_tokens`);
  required-before-optional param sort (AC-4).
- `ce_client.py` — CeClient fetch adapter (CE-READ-1 / CE-FUNCTION-1 / CE-BRAND-1). Fetches raw Turtle
  shapes via `GET /api/ontology/shapes?version={version_iri}` (ADR-019: NOT the lossy
  `/api/ontology/types` projection).
- `emit_typescript.py` / `emit_python.py` / `emit_openapi.py` — 3 emitters (jinja2 templates,
  autoescape=False justified for codegen). Each has a REAL codegen test: emitted TS → `tsc --noEmit`,
  emitted Python → `mypy --strict`, emitted OpenAPI → YAML parse + structural lint (AC-7).
- `validate.py` — post-emit validators (subprocess to real toolchains, S603 nosec justified).
- `pipeline.py` — `generate_sdk` orchestration: fetch → IR → emit(3) → validate → **atomic staging dir**
  (all-or-nothing).

## Tests

- Unit: IR mapping, CeClient, per-emitter compile tests. 759 total green.
- Integration (docker-marked, unrun): golden-file (checked-in fixture `tests/integration/fixtures/sdkgen_golden/`,
  NOT run-twice-determinism — advisor-flagged + fixed), fixture-registry, atomicity (mid-pipeline
  failure → no partial staging), poisoned-template-fails.

## Decisions

- **ADR-019** — BE-SDK-1 fetches raw Turtle shapes, not the lossy types projection.
- Atomic staging (all-or-nothing) so a mid-pipeline failure leaves no partial SDK.
- Codegen "real test" = shell the actual toolchain against emitted output, not string-compare.

## Commits (feature/BE-V1-EPIC-008)

- `cab7c7a`·`2c31e45` IR · `aef832b`·`497250d` CeClient · `a77b52f` ADR-019 · `a259aff` param-sort ·
  `11adaf5` TS emitter · `9a3544f` Python+OpenAPI emitters · pipeline + `77e3700` golden fixture.

## Dependencies

- **blocked_by:** [] · Queue in EPIC-008 lane: **TASK-005** (SDK Trigger API, breaking:true ack,
  provenance regen — needs TASK-004 ✓ AND TASK-001 which is on EPIC-002 branch — so TASK-005 must
  branch off / merge EPIC-002+EPIC-008, note for lane sequencing), **TASK-009** (Anatomy Indexer).
- `validate.py` alone at 73% cov (defensive error branches) — noted, aggregate 87% ≥ 80%.

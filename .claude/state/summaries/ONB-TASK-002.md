# TASK-002 — hammerbarn-seed apply + CLI verify wiring

## What shipped this pass

- `packages/backend/src/weave_backend/onboarding/hammerbarn_seed/apply.py`
  - `apply_seed()` — posts each compiled batch to `POST /api/operations/apply`
    (`target=draft`), halts on the first `422` (`SeedApplyHalted`, batch index +
    violations attached), publishes only the final batch's `version_iri` via
    `POST /api/ontology/versions/{version_iri}/publish`.
  - `ask_count()` — SPARQL `COUNT(*)` over `/api/sparql`, backing the CLI's
    `--verify` convergence check (AC-002-04).
- `packages/backend/tests/integration/test_hammerbarn_seed_apply.py` — happy-path
  publish, SHACL-halt-mid-batch, and idempotent-rerun scenarios, all against the
  real CE-WRITE-1/CE-VERSION-1 HTTP surface (never the direct `apply_operations`/
  `mint_version` calls `db/seed_demo.py` uses — this is the task brief's "live
  pipeline" requirement).

## Gates run this pass

| Gate | Result |
|---|---|
| Hermetic unit tests (`-m "not docker and not e2e"`, poisoned `LOCALSTACK_ENDPOINT_URL`/`OXIGRAPH_URL`) | green, exit 0 |
| `ruff check .` | clean (fixed 2 findings: one E501 line-too-long, one stale `noqa`) |
| `mypy` on the two new/changed files | clean |
| OKF conformance (`okf_validate.py docs/wiki`) | conformant, 1 pre-existing tolerated warning |
| pre-commit / pre-push hooks | passed both commits; semgrep passed on push |

## Docker-integration test — env-deferred

`test_apply_happy_path_publishes_one_version` (the one docker-marked scenario)
was run once against an isolated per-worktree stack (own `.env` port mapping,
not the lanes' shared stack — see below) and got past the docker-compose
bring-up, then failed with `SeedApplyHalted` on SHACL violations for missing
`skos:prefLabel` on IRIs like `class-eac35d9902c8465f...` — hex-suffixed refs
that do **not** match anything `content.py` emits (its refs are all
human-readable, e.g. `class-product`). That points to stale/contaminated data
already present in that oxigraph instance from an unrelated prior run, not a
bug in this task's code. Per the coordinator's guidance, not chasing this
further or restarting any shared stack — CI runs this test against fresh
services and will actually gate it.

Side note for whoever debugs this in CI/QA: if this same hex-ref-missing-
prefLabel violation reproduces in a clean CI environment (not just here), it
would need a fresh look — but the localhost-only symptom (fabricated refs no
seed code emits) is the strongest signal it's local data leakage, not a
real defect.

## Local-dev note (not a task deliverable, flagging for QA/other lanes)

This worktree (`weave-ONB-EPIC-001b`) had no `.env`, so its `docker-compose.yml`
defaulted to host ports 5432/6379/4566/7878 — colliding with another lane's
stack (`weave-plat-v1-epic-009`) already squatting the same unremapped
defaults. Added a worktree-local `.env` (ports 5450/6397/4578/7886, not
committed — matches the `.gitignore`'d pattern other worktrees already use)
so this worktree's docker-integration tests can run in isolation without
touching any other lane's containers. No harness file changed.

## Scope note

This is a partial pass on ONB-EPIC-001 — TASK-002's apply/verify slice only.
The CLI entrypoint wiring `apply_seed`/`ask_count` together (argparse, output
formatting) is not part of this commit; check the task brief for whether
that's a separate task or the remaining half of TASK-002.

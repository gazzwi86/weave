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

## Docker-integration test — CORRECTION: was a real bug, not local contamination

The "local contamination" theory below (originally written after the first
pass) was **wrong** — PR #81's CI `integration` job failed identically
against fresh services, proving these were genuine content/logic bugs. The
hex-suffixed IRIs (`class-eac35d9902c8465f...`) that looked like stale data
are in fact **expected**: `graph_ops.py`'s `_apply_add_node` mints every
node's real IRI with a `uuid4().hex` suffix server-side, so no seeded IRI
ever textually matches `content.py`'s human-readable `ref`s — that was never
a contamination signal, it's how the server always behaves.

Root causes found and fixed (all against my own isolated
`docker compose -p weave-onb-epic-001b` stack, never the shared one):

1. **Missing `skos:prefLabel`** on every vocabulary-class / glossary-term
   node punned as `skos:Concept` — `GlossaryTermShape` requires one per
   language. Glossary terms were also missing the `owl:Class` pun and
   `skos:definition`. Fixed in `content.py`.
2. **Process nodes committed before their `performedBy` edges.**
   `compile_seed` batches all nodes first, then all edges, and CE-WRITE-1
   revalidates the *full* graph on every batch commit — so the node-only
   batch always violated `ProcessShape`'s `performedBy` minCount 1, even
   though the edge would land moments later in the next batch. Fixed by
   interleaving each process's `performedBy` edge immediately after its own
   node in `content.node_ops()` (now a mixed `AddNodeOp | AddEdgeOp`
   stream — `compile.py` and the unit tests were updated to match).
3. **Cross-batch ref resolution silently broken.** Node IRIs are minted
   non-deterministically (`uuid4().hex` suffix) and `ApplyResponse.ref_map`
   is scoped to a single request/batch — so a later batch's edge referencing
   an earlier batch's node `ref` had nothing to resolve against. Fixed by
   having `apply_seed()` accumulate `ref_map` across batches and rewrite
   each edge op's `subject_ref`/`object_ref` before sending it.
4. **`ask_count()`'s SPARQL query had no `GRAPH` clause** — `/api/sparql`
   hard-rejects any query without one (`UnscopedQueryError`). Added a
   `GRAPH ?g { }` wrapper (the actual graph scoping happens server-side at
   the SPARQL protocol layer, so the clause's IRI/var name doesn't matter,
   only that it's present).
5. **Test fixture RBAC gap** — `_setup_content_admin()` granted
   `role="author"` (rank 1), but the publish route requires `role="publish"`
   (rank 2). Raised to match.
6. **Test's deliberately-invalid op never reached the server** — an empty
   `label` fails client-side Pydantic validation before any HTTP call.
   Replaced with a non-empty-labelled, edge-less `Process` node, which
   genuinely 422s server-side via bug 2's now-real `performedBy` minCount
   check.
7. **Test idempotency-key collision** — the bad-batch artefact reused
   the real artefact's `semver` + batch index 0, so `apply_seed`'s
   idempotency cache silently replayed the real (successful) batch 0
   instead of exercising the bad op. Gave it a distinct `semver`.

All three integration scenarios (happy-path publish, SHACL-halt, idempotent
rerun) now pass against a fresh isolated stack. Also spot-checked seed
content directly (no server) to confirm SHACL conformance: 5 Process nodes,
all with a `performedBy` edge to one of 16 real Actor nodes; 18
`skos:Concept`-punned nodes, all with both `skos:definition` and
`skos:prefLabel`.

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

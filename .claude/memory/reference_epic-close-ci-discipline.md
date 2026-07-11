---
name: reference_epic-close-ci-discipline
description: Reconcile/epic-close CI-discipline that keeps epic PRs green first time — poison-endpoint hermeticity, whole-repo ruff, OKF gate, migration/ADR numbering
metadata:
  type: reference
---

Learned the hard way over the M2/V1 build (build-engine-v1/phase-1, 2026-07-11/12): CI reddens epic PRs for
reasons a naive "tests pass locally" never catches. Before pushing ANY reconciled epic branch, a delegated
engineer (not the coordinator — its local env is often broken) must run, from `packages/backend`:

1. **Poisoned-endpoint hermeticity (PROJ-014, the #1 repeat offender):**
   `LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1 OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e" -p no:warnings -q`
   A UNIT test that makes a real network call (oxigraph httpx / LocalStack+secretsmanager boto / `audit.emitter.get_signing_key`)
   PASSES locally whenever a `WEAVE_KEEP_STACK=1` docker stack is still up, but CI's `api` job runs with NO services →
   `ConnectError`/`EndpointConnectionError` → api + mutation(a/b) RED. "docker down" is not enough (stale stacks). Fix = mock the
   seam (`patch("weave_backend.audit.emitter.get_signing_key", ...)` / AsyncMock the oxigraph client). Common hidden seam:
   anything through `run_dor_gate → record_gate → audit emit → get_signing_key`, or `commit_tenant_shape → write_shape_activity
   → provenance.append_graph`.
2. **Whole-repo `ruff check .`** (not just changed files): a `git merge origin/main` can introduce a ruff **I001** import-sort in
   a file the last commit never touched → the changed-file-scoped pre-push hook passes but CI's whole-repo `ruff check .` is RED.
3. **`python3 .claude/scripts/okf_validate.py docs`** must be CONFORMANT: a new/renamed ADR or doc missing YAML frontmatter
   (`type/title/description/tags/timestamp`) fails the pre-push OKF gate and blocks the push entirely.
4. **Docker integration marker:** `-m "docker and not e2e and not stack"` — `test_local_stack.py` self-runs `docker compose down -v`
   mid-run and cascades false failures otherwise (PROJ-003).
5. **Migration/ADR numbering:** new migration = next GLOBAL number (watch for numbers reserved on other open/HELD branches — e.g.
   0065/0067 lived on a HELD PR; a new one had to be 0068 to avoid a post-merge collision). New ADRs = next free, watch cross-branch
   collision (two files sharing `ADR-NNN-*` coexist but confuse — renumber the newer). Full findings in `qa-project-issues.md`.

Also: CI's `ce-perf` job fails on EVERY PR (non-blocking, ignore); `mutation-strict` shows "skipping" (not blocking). Auto-merge
only on all OTHER blocking checks green + cavecrew review Blocker/Major-free + non-risky; HOLD for human if the diff touches
migrations/schema, auth, multi-tenancy, or the harness. See [[project_poc-usability-drive]] for the phase context.

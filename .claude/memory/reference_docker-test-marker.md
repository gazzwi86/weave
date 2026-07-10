---
name: docker-test-marker
description: The correct backend docker-integration test command is `-m "integration and docker and not stack"` — plain `integration and docker` self-corrupts the shared stack
metadata:
  type: reference
---

**Run backend docker-integration tests with `-m "integration and docker and not stack"`**, NOT the
task briefs' literal `-m "integration and docker"`.

**Why:** the plain marker drags in `tests/integration/test_dev_stack_healthy.py`, which is
`@pytest.mark.stack` and runs its own `docker compose down -v` mid-session — tearing down the shared
`platform_stack`/`platform_stack`-fixture Postgres for every alphabetically-later test file, causing
spurious failures unrelated to the code under test. Registered in `pyproject.toml`'s marker registry;
`.github/workflows/ci.yml` already excludes `stack` from the integration lane. Discovered
2026-07-10 during BE-V1-TASK-022 (engineer traced noisy docker results to this).

**How to apply:**
- Delegate docker verification with `uv run pytest -m "integration and docker and not stack"` (or
  scope to specific files, e.g. `pytest tests/integration/test_v1_pm_tables.py -m "integration and docker and not stack"`).
- Coverage is still unit-lane only on the docker path (PROJ-013: asyncpg+`--cov` segfaults).
- Known unrelated flake in this lane: `test_runs_api.py::test_one_pdac_cycle_commits_state_spine_dispatch_count_1`
  fails intermittently even in isolation with no bindings/feature code involved — a pre-existing
  sandbox flake, not a regression signal. Logged to `qa-project-issues.md`.

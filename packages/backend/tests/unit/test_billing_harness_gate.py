"""QA blocker fix (PLAT-TASK-008): `simulate-ai-call`/`simulate-run` call the
real `ai_route()` and incur real billed spend, so RBAC alone isn't enough --
`harness_router` must only be mounted when `WEAVE_ENV` is `dev`/`test`. The
app is a module-level singleton built once at import (`weave_backend/__init__.py`),
so proving the gate requires importing it fresh in a subprocess per env value
-- an in-process re-import would just hit the cached module in `sys.modules`.

Each subprocess makes a real (unauthenticated) HTTP request via TestClient
rather than introspecting `app.routes` -- FastAPI defers route flattening
behind `_IncludedRouter` wrapper objects, so a route-graph walk isn't a
reliable signal here, but a 404 vs. 401 response unambiguously is.
"""

from __future__ import annotations

import os
import subprocess
import sys

_PROBE = """
from fastapi.testclient import TestClient
from weave_backend import app

client = TestClient(app)
for path in ("/api/billing/simulate-ai-call", "/api/billing/simulate-run"):
    print(path, client.post(path, json={}).status_code)
"""


def _probe_status_codes(weave_env: str | None) -> dict[str, int]:
    env = {k: v for k, v in os.environ.items() if k != "WEAVE_ENV"}
    if weave_env is not None:
        env["WEAVE_ENV"] = weave_env
    result = subprocess.run(
        [sys.executable, "-c", _PROBE],
        capture_output=True,
        text=True,
        timeout=30,
        env=env,
    )
    assert result.returncode == 0, result.stderr
    codes: dict[str, int] = {}
    for line in result.stdout.splitlines():
        path, status = line.rsplit(" ", 1)
        codes[path] = int(status)
    return codes


def test_harness_routes_404_when_weave_env_is_production() -> None:
    codes = _probe_status_codes("production")
    assert codes["/api/billing/simulate-ai-call"] == 404
    assert codes["/api/billing/simulate-run"] == 404


def test_harness_routes_404_when_weave_env_is_unset() -> None:
    codes = _probe_status_codes(None)
    assert codes["/api/billing/simulate-ai-call"] == 404
    assert codes["/api/billing/simulate-run"] == 404


def test_harness_routes_reachable_when_weave_env_is_dev() -> None:
    codes = _probe_status_codes("dev")
    # 401 (unauthenticated), not 404 -- the route exists and RBAC runs.
    assert codes["/api/billing/simulate-ai-call"] == 401
    assert codes["/api/billing/simulate-run"] == 401


def test_harness_routes_reachable_when_weave_env_is_test() -> None:
    codes = _probe_status_codes("test")
    assert codes["/api/billing/simulate-ai-call"] == 401
    assert codes["/api/billing/simulate-run"] == 401

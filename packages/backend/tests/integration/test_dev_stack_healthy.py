"""AC-1: `make dev`'s local-first services (postgres, redis, oxigraph) become
healthy within 60s, and GET /api/health accurately reports it. Narrower and
faster than test_local_stack.py's full 5-service docker-compose boot — this
brings up only the three services /api/health checks.
"""

from __future__ import annotations

import shutil
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    # stack: this file's `running_services` fixture manages its own compose stack and
    # tears it down (`down -v`) mid-session — running it alongside the shared
    # `platform_stack` fixture kills that stack's containers for every test sorting
    # after it. Same convention as test_local_stack.py; run explicitly, never in the
    # `and not stack` lane.
    pytest.mark.stack,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

BOOT_TIMEOUT_SECONDS = 60
POLL_INTERVAL_SECONDS = 2
SERVICES = ("postgres", "redis", "oxigraph")


def _compose(repo_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", "compose", *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=120,
    )


@pytest.fixture
def running_services(repo_root: Path) -> Iterator[Path]:
    up = _compose(repo_root, "up", "-d", *SERVICES)
    assert up.returncode == 0, f"docker compose up failed\n{up.stdout}\n{up.stderr}"
    try:
        yield repo_root
    finally:
        _compose(repo_root, "down", "-v")


async def test_dev_stack_healthy(running_services: Path) -> None:
    transport = ASGITransport(app=app)
    deadline = time.monotonic() + BOOT_TIMEOUT_SECONDS

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        body: dict[str, object] = {}
        while time.monotonic() < deadline:
            response = await client.get("/api/health")
            body = response.json()
            if body.get("status") == "ok":
                break
            time.sleep(POLL_INTERVAL_SECONDS)

        assert body.get("status") == "ok", f"stack not healthy within 60s: {body}"
        assert body["services"] == {"postgres": "ok", "redis": "ok", "oxigraph": "ok"}

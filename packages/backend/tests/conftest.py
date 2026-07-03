"""Shared fixtures for the platform-scaffold + IaC test suite (TASK PLAT-TASK-001)
and the PLAT-TASK-003 tenancy/settings/sparql integration tests.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import pytest

from weave_backend.db.migrate import run_migrations


def _find_repo_root(start: Path) -> Path:
    """Walk up from ``start`` until a directory containing ``.git`` is found."""
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    raise RuntimeError("could not locate repo root (no .git ancestor)")


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return _find_repo_root(Path(__file__).resolve())


# --- PLAT-TASK-003: shared docker-compose fixture -----------------------
#
# Session-scoped: boots postgres+redis+localstack+oxigraph once (not ollama
# -- not needed by tenancy/settings/sparql tests) and applies migrations, so
# all tests needing it share one boot/teardown rather than paying the
# cold-image cost per test. Mirrors ``test_local_stack.py``'s
# compose-up/down pattern but narrower in scope and session-scoped instead
# of per-test.

_PLATFORM_SERVICES = ("postgres", "redis", "localstack", "oxigraph")
_PLATFORM_BOOT_TIMEOUT_SECONDS = 240
_PLATFORM_POLL_INTERVAL_SECONDS = 3


def _compose(repo_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", "compose", *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=300,
    )


def _core_services_healthy(repo_root: Path) -> bool:
    result = _compose(repo_root, "ps", "--format", "json")
    if result.returncode != 0:
        return False
    statuses: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        statuses[entry["Service"]] = entry.get("Health", "")
    # oxigraph has no Docker-native healthcheck (no shell/curl in its image,
    # see docker-compose.yml) -- readiness is polled separately below.
    return all(statuses.get(svc) == "healthy" for svc in ("postgres", "redis"))


def _oxigraph_reachable() -> bool:
    result = subprocess.run(
        [
            "curl",
            "-sf",
            "http://localhost:7878/query?query=" + "ASK%20%7B%20%3Fs%20%3Fp%20%3Fo%20%7D",
        ],
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.returncode == 0


@pytest.fixture(scope="session")
def platform_stack(repo_root: Path) -> Iterator[Path]:
    up = _compose(repo_root, "up", "-d", *_PLATFORM_SERVICES)
    assert up.returncode == 0, f"docker compose up failed\n{up.stdout}\n{up.stderr}"
    try:
        deadline = time.monotonic() + _PLATFORM_BOOT_TIMEOUT_SECONDS

        def _ready() -> bool:
            return _core_services_healthy(repo_root) and _oxigraph_reachable()

        while time.monotonic() < deadline and not _ready():
            time.sleep(_PLATFORM_POLL_INTERVAL_SECONDS)
        assert _ready(), "postgres/redis/localstack/oxigraph did not become ready in time"

        asyncio.run(run_migrations())
        yield repo_root
    finally:
        _compose(repo_root, "down", "-v")

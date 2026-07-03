"""AC-1b: `docker compose up` boots the full local-first stack with seed data
and zero live AWS calls.

Marked both `integration` and `docker`: CI's default fast lane excludes both;
a nightly/local job can run `pytest -m docker` to exercise this for real. It
pulls real images (localstack, ollama, postgres, redis, oxigraph) so it can
take minutes on a cold cache — that cost is intentional and documented, not a
flake to chase.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import pytest

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

SERVICES = ("oxigraph", "postgres", "localstack", "redis", "ollama")
BOOT_TIMEOUT_SECONDS = 240
POLL_INTERVAL_SECONDS = 5


def _compose(repo_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", "compose", *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=300,
    )


def _all_healthy(repo_root: Path) -> bool:
    result = _compose(repo_root, "ps", "--format", "json")
    if result.returncode != 0:
        return False
    statuses = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        statuses[entry["Service"]] = entry.get("Health", "")
    return all(statuses.get(svc) == "healthy" for svc in SERVICES)


@pytest.fixture
def running_stack(repo_root: Path) -> Iterator[Path]:
    up = _compose(repo_root, "up", "-d")
    assert up.returncode == 0, f"docker compose up failed\n{up.stdout}\n{up.stderr}"
    try:
        yield repo_root
    finally:
        _compose(repo_root, "down", "-v")


def test_local_stack_boots(running_stack: Path) -> None:
    repo_root = running_stack

    deadline = time.monotonic() + BOOT_TIMEOUT_SECONDS
    while time.monotonic() < deadline and not _all_healthy(repo_root):
        time.sleep(POLL_INTERVAL_SECONDS)

    assert _all_healthy(repo_root), "not all 5 local-first services became healthy in time"

    # Seed data present: postgres seed table populated by docker-entrypoint-initdb.d.
    pg_check = subprocess.run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            "weave",
            "-d",
            "weave",
            "-tAc",
            "select count(*) from seed_check;",
        ],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert pg_check.returncode == 0, pg_check.stderr
    assert int(pg_check.stdout.strip()) > 0, "expected seeded rows in postgres seed_check table"

    # Seed data present: oxigraph has at least one triple loaded.
    oxigraph_check = subprocess.run(
        [
            "curl",
            "-sf",
            "-H",
            "Accept: application/sparql-results+json",
            "http://localhost:7878/query?query=" + "ASK%20%7B%20%3Fs%20%3Fp%20%3Fo%20%7D",
        ],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert oxigraph_check.returncode == 0, oxigraph_check.stderr
    assert json.loads(oxigraph_check.stdout)["boolean"] is True

    # Zero live AWS: localstack is the only thing answering AWS-shaped endpoints.
    localstack_check = subprocess.run(
        ["curl", "-sf", "http://localhost:4566/_localstack/health"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert localstack_check.returncode == 0

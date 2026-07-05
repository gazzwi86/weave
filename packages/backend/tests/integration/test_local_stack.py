"""AC-1b: `docker compose up` boots the full local-first stack with seed data
and zero live AWS calls.

Marked both `integration` and `docker`: CI's default fast lane excludes both;
a nightly/local job can run `pytest -m docker` to exercise this for real. It
pulls real images (localstack, postgres, redis, oxigraph) so it can take
minutes on a cold cache — that cost is intentional and documented, not a
flake to chase.

Ollama is deliberately NOT part of this default-stack check (ADR-011): it is
opt-in behind the `ollama` compose profile and runs natively on the host for
dev, so `docker compose up` does not start it.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import pytest

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    # PR #11 finding 5: this test manages its own full docker-compose
    # lifecycle (the default-profile services; ollama is opt-in per ADR-011
    # and excluded); CI's `integration` job only starts the services the
    # tenancy security suite needs, so this is excluded from it via
    # `-m "integration and docker and not stack"`.
    pytest.mark.stack,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

# oxigraph is checked separately: its official image is a single static
# binary with no shell/curl, so it can't run a Docker-native HEALTHCHECK
# (verified via `docker inspect` + `docker run --entrypoint sh`). Readiness
# *and* seeding are confirmed together via _oxigraph_seeded() below — the
# ASK query only returns true once the oxigraph-seed loader has run.
SERVICES = ("postgres", "localstack", "redis")
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


def _oxigraph_seeded() -> bool:
    port = os.environ.get("WEAVE_OXIGRAPH_PORT", "7878")
    result = subprocess.run(
        [
            "curl",
            "-sf",
            "-H",
            "Accept: application/sparql-results+json",
            f"http://localhost:{port}/query?query=" + "ASK%20%7B%20%3Fs%20%3Fp%20%3Fo%20%7D",
        ],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0:
        return False
    return bool(json.loads(result.stdout)["boolean"])


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

    def _ready() -> bool:
        return _all_healthy(repo_root) and _oxigraph_seeded()

    deadline = time.monotonic() + BOOT_TIMEOUT_SECONDS
    while time.monotonic() < deadline and not _ready():
        time.sleep(POLL_INTERVAL_SECONDS)

    assert _ready(), "not all default-stack services became healthy (and seeded) in time"

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

    # Seed data present: oxigraph has at least one triple loaded (already
    # confirmed by the wait loop above via _oxigraph_seeded(), re-asserted
    # here so a failure reads as an explicit test assertion, not a timeout).
    assert _oxigraph_seeded(), "expected at least one triple loaded in oxigraph"

    # Zero live AWS: localstack is the only thing answering AWS-shaped endpoints.
    localstack_port = os.environ.get("WEAVE_LOCALSTACK_PORT", "4566")
    localstack_check = subprocess.run(
        ["curl", "-sf", f"http://localhost:{localstack_port}/_localstack/health"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert localstack_check.returncode == 0

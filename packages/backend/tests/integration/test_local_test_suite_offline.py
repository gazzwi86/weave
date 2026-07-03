"""AC-7: `make test` runs the unit+integration suite offline, with no cloud
credentials, in well under 5 minutes.

Actually invoking `make test` recursively from inside a test that `make
test` itself would discover risks infinite recursion / blowing the time
budget it's meant to enforce. Instead (mirroring `test_ci_workflow.py`'s
static-assertion pattern) this parses the `Makefile`'s `test` target and
asserts the properties that make it offline-safe: it excludes the
`docker`-marked tests (which need a live compose stack) and the
`e2e`-marked/Playwright suite (which needs running dev servers + browsers),
and it references no AWS/cloud environment variables.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

CLOUD_ENV_NEEDLES = ("AWS_ACCESS_KEY", "AWS_SECRET", "AWS_SESSION_TOKEN", "AWS_PROFILE")


def _test_target_body(repo_root: Path) -> str:
    makefile = (repo_root / "Makefile").read_text()
    match = re.search(r"^test:\n((?:\t.*\n?)+)", makefile, re.MULTILINE)
    assert match, "Makefile has no `test:` target"
    return match.group(1)


def test_make_test_excludes_docker_and_e2e_markers(repo_root: Path) -> None:
    body = _test_target_body(repo_root)

    assert "uv run pytest" in body, "`make test` must run the backend pytest suite"
    assert "not docker" in body, "`make test` must exclude docker-marked (live compose) tests"
    assert "not e2e" in body, "`make test` must exclude e2e-marked (Playwright) tests"


def test_make_test_requires_no_cloud_credentials(repo_root: Path) -> None:
    body = _test_target_body(repo_root)

    found = [needle for needle in CLOUD_ENV_NEEDLES if needle in body]
    assert not found, f"`make test` must not require cloud credentials, found: {found}"

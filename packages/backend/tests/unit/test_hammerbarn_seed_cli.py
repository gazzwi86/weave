"""Unit tests for `onboarding/hammerbarn_seed/cli.py` (TASK-002 DoD: "CLI
documented (--compile, --apply --workspace <id>, --verify)"). Only the
offline `--compile` path and argument-validation branches are unit-tested
here -- `--apply`/`--verify` need a live stack and are covered end-to-end
by `apply.py`'s own integration tests (`test_hammerbarn_seed_apply.py`)
plus this session's manual live-stack verification.
"""

from __future__ import annotations

import argparse
import json

import httpx
import pytest

from weave_backend.onboarding.hammerbarn_seed import cli


def _args(**overrides: str | bool | None) -> argparse.Namespace:
    parser = cli._build_parser()
    defaults: dict[str, str | bool | None] = {
        "compile": False,
        "apply": False,
        "verify": False,
        "workspace": None,
        "base_url": "http://localhost:8000",
        "token": None,
        "actor": "urn:weave:principal:service:hammerbarn-seed",
    }
    defaults.update(overrides)
    return parser.parse_args(
        [f"--{k.replace('_', '-')}" for k, v in defaults.items() if v is True]
        + (["--workspace", str(defaults["workspace"])] if defaults["workspace"] else [])
        + (["--base-url", str(defaults["base_url"])] if defaults["base_url"] else [])
        + (["--token", str(defaults["token"])] if defaults["token"] else [])
        + (["--actor", str(defaults["actor"])] if defaults["actor"] else [])
    )


async def test_run_with_no_flags_returns_2(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = await cli._run(_args())

    assert exit_code == 2
    assert "pass --compile" in capsys.readouterr().err


async def test_run_apply_without_token_returns_2(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = await cli._run(_args(apply=True, workspace="ws-1"))

    assert exit_code == 2
    assert "--token is required" in capsys.readouterr().err


async def test_run_apply_without_workspace_returns_2(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = await cli._run(_args(apply=True, token="tok"))

    assert exit_code == 2
    assert "--workspace is required" in capsys.readouterr().err


async def test_run_compile_offline_prints_artefact_shape(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """No `--token`: falls back to the local ontology catalogue (module
    docstring) -- no network call, so this runs with no stack up at all.
    """
    exit_code = await cli._run(_args(compile=True))

    assert exit_code == 0
    body = json.loads(capsys.readouterr().out.strip())
    assert body["semver"] == "1.1.0"
    assert body["batches"] > 0
    assert body["ops"] > 0


def _publish_error(status_code: int, detail: object) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "http://test/api/ontology/versions/urn:x/publish")
    response = httpx.Response(status_code, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError("boom", request=request, response=response)


def test_is_already_published_matches_ac_002_09_exact_wording() -> None:
    """Found via manual live-stack verification: a content-unchanged rerun
    of `--apply` hits `apply_seed`'s deliberate republish-refusal (a
    published version is immutable, AC-002-09) -- `_run` treats exactly
    this error as an idempotent no-op, everything else re-raises.
    """
    exc = _publish_error(405, {"message": "version is published and immutable"})

    assert cli._is_already_published(exc) is True


def test_is_already_published_false_for_other_405_messages() -> None:
    exc = _publish_error(405, {"message": "something else entirely"})

    assert cli._is_already_published(exc) is False


def test_is_already_published_false_for_non_405_status() -> None:
    exc = _publish_error(500, {"message": "version is published and immutable"})

    assert cli._is_already_published(exc) is False

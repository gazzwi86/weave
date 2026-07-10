"""BE-TASK-007 (build-engine EPIC-012) integration tests: `qa_suite.run_full_qa_suite`
persistence against the real docker-marked stack (Postgres + RLS +
`PLAT-AUDIT-1`) -- same lane conventions as `test_gates_api.py`
(BE-TASK-007 M1). `run_full_qa_suite` has no router (task brief: "No
public endpoint -- invoked by the ceremony and available to the
orchestrator"), so these call it directly against a real tenant
connection rather than through an HTTP client.
"""

from __future__ import annotations

import shlex
import shutil
import subprocess
import uuid
from collections.abc import Callable
from pathlib import Path
from unittest.mock import patch

import pytest

from weave_backend.build.qa_agent import CommandOutcome
from weave_backend.build.qa_suite import QAProject, QARunContext, run_full_qa_suite
from weave_backend.db.pool import tenant_connection

_EVIDENCE_TRUNCATE_CHARS = 500


def _make_run_command(directory: Path) -> Callable[[str], CommandOutcome]:
    """Factory for a `qa_agent.run_command`-compatible callable pinned to
    `directory` via `cwd=`, without a process-wide `os.chdir`.

    `qa_agent.run_command` shells out relative to the process CWD, and a
    prior version of this test used `monkeypatch.chdir` for that. Under
    `mutmut run`, every mutated-function call re-resolves `source_paths`
    against the *current* CWD (`mutmut/__main__.py::record_trampoline_hit`)
    -- a process-wide chdir mid-test made every subsequent DB call (which
    passes through mutated `weave_backend.db.pool` code) crash with
    `FileNotFoundError: 'src'` once CWD pointed at `tmp_path`. Passing an
    explicit `cwd` to `subprocess.run` keeps the real-tool-execution
    guarantee (FR-047) without ever touching process CWD.
    """

    def _run(cmd: str) -> CommandOutcome:
        try:
            result = subprocess.run(
                shlex.split(cmd), cwd=directory, capture_output=True, text=True, check=False
            )
        except FileNotFoundError as exc:
            return CommandOutcome(
                status="NOT_VERIFIED", evidence=str(exc)[:_EVIDENCE_TRUNCATE_CHARS]
            )
        if result.returncode == 0:
            return CommandOutcome(status="PASS", returncode=0)
        return CommandOutcome(
            status="FAIL",
            evidence=result.stderr[:_EVIDENCE_TRUNCATE_CHARS],
            returncode=result.returncode,
        )

    return _run

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _run_ctx(tenant_id: str, **overrides: object) -> QARunContext:
    defaults: dict[str, object] = {
        "tenant_id": tenant_id,
        "actor_iri": "urn:weave:principal:user:u-1",
        "project_iri": f"urn:weave:project:{tenant_id}:acme",
    }
    defaults.update(overrides)
    return QARunContext(**defaults)  # type: ignore[arg-type]


async def test_records_one_gate_row_per_applicable_category(platform_stack: Path) -> None:
    """AC-1: fixture project (headless, no SLO), stub runners -- 9 category
    rows + 1 aggregate row land in `gate_results`.
    """
    tenant_id = f"tenant-qa-{uuid.uuid4().hex[:8]}"
    run_ctx = _run_ctx(tenant_id)
    project = QAProject(has_ui=False, slo=None)

    with patch(
        "weave_backend.build.qa_suite.qa_agent.run_command",
        return_value=CommandOutcome(status="PASS"),
    ):
        async with tenant_connection(tenant_id) as conn:
            result = await run_full_qa_suite(conn, run_ctx=run_ctx, project=project)

    assert result["result"] == "PASS"
    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT gate, result FROM gate_results WHERE tenant_id = $1 AND gate LIKE 'qa_%'",
            tenant_id,
        )
    # 9 categories + 1 qa_full aggregate.
    assert len(rows) == 10
    aggregate = next(r for r in rows if r["gate"] == "qa_full")
    assert aggregate["result"] == "PASS"


async def test_runs_real_coverage_and_lint_against_fixture_project(
    platform_stack: Path, tmp_path: Path
) -> None:
    """Small seeded repo, real `pytest --cov` and `ruff check .` -- proves
    the cmd-based categories genuinely shell out (Law F: no simulated
    result), same precedent as `test_qa_agent.py` for the M1 DoD gate.

    Pins the fixture repo via `subprocess.run(cwd=...)` (see
    `_make_run_command`) rather than `monkeypatch.chdir` -- a process-wide
    chdir here breaks mutmut's mutation-strict lane (see that helper's
    docstring).
    """
    (tmp_path / "tiny.py").write_text("def add(a: int, b: int) -> int:\n    return a + b\n")
    (tmp_path / "test_tiny.py").write_text(
        "from tiny import add\n\n\ndef test_add() -> None:\n    assert add(1, 2) == 3\n"
    )
    (tmp_path / "pyproject.toml").write_text("[tool.ruff]\nline-length = 100\n")

    tenant_id = f"tenant-qa-{uuid.uuid4().hex[:8]}"
    run_ctx = _run_ctx(tenant_id)
    project = QAProject(has_ui=False, slo=None)

    with patch(
        "weave_backend.build.qa_suite.qa_agent.run_command",
        side_effect=_make_run_command(tmp_path),
    ):
        async with tenant_connection(tenant_id) as conn:
            result = await run_full_qa_suite(conn, run_ctx=run_ctx, project=project)

    categories = {c["category"]: c["verdict"] for c in result["categories"]}
    assert categories["coverage"] == "passed"
    assert categories["lint"] == "passed"


async def test_streams_long_lane_progress_to_run_log(platform_stack: Path) -> None:
    """Suite budget note: long lanes (mutation, Playwright) stream progress
    rather than the suite blocking silently for the ceremony's ~10 min p95
    budget -- stub mutation lane, real gate persistence.
    """
    tenant_id = f"tenant-qa-{uuid.uuid4().hex[:8]}"
    messages: list[tuple[str, str]] = []
    run_ctx = _run_ctx(
        tenant_id, progress_cb=lambda category, message: messages.append((category, message))
    )
    project = QAProject(
        has_ui=True, slo=None, browser_result={"passed": True, "backend_assertions": 1}
    )

    def _fake_run_command(cmd: str) -> CommandOutcome:
        if cmd.startswith("mutmut"):
            return CommandOutcome(status="PASS")
        return CommandOutcome(status="PASS")

    with patch(
        "weave_backend.build.qa_suite.qa_agent.run_command", side_effect=_fake_run_command
    ):
        async with tenant_connection(tenant_id) as conn:
            await run_full_qa_suite(conn, run_ctx=run_ctx, project=project)

    streamed = {category for category, _ in messages}
    assert "delta_mutation" in streamed
    assert "browser_backend" in streamed
    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT gate FROM gate_results WHERE tenant_id = $1 AND gate = 'qa_delta_mutation'",
            tenant_id,
        )
    assert len(rows) == 1

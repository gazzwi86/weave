"""CE-V1-TASK-030 (AC-6/AC-7): the M2 gate-bundle + gate-config meta-tests.

Pure filesystem/YAML checks -- no docker, no network (Law F). AC-1's
isolation suite lives in `tests/integration/test_m2_release_gate.py`
because it needs the real docker-compose stack; these two stay unit-speed.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml


def _find_repo_root(start: Path) -> Path:
    """Walk up from `start` until a repo-root marker is found.

    A fixed `parents[N]` index breaks under mutmut, which copies this test
    tree into a `mutants/` subdirectory -- shifting every ancestor by one
    level and landing `parents[4]` on `packages/backend` instead of the real
    repo root. Walking up to a marker (`.github/workflows/ci.yml` or `.git`)
    is robust to that extra path segment.
    """
    for candidate in (start, *start.parents):
        ci_marker = candidate / ".github" / "workflows" / "ci.yml"
        if ci_marker.exists() or (candidate / ".git").exists():
            return candidate
    raise RuntimeError(f"no repo root found walking up from {start}")


_REPO_ROOT = _find_repo_root(Path(__file__).resolve())
_CI_WORKFLOW = _REPO_ROOT / ".github" / "workflows" / "ci.yml"
_GATE_JOBS = ("axe-m2", "lighthouse-explorer", "perf-m2", "invariants-check")


def test_gate_bundle_completeness() -> None:
    """AC-6: the gate bundle is one artefact directory with every named
    file/subdir present. `.claude/scripts/build_m2_gate_bundle.sh` is the
    producer; this test verifies its output manifest once it has run.
    """
    bundle = _REPO_ROOT / "artefacts" / "m2-gate"
    required = {
        "isolation-report.json",
        "axe",
        "lighthouse",
        "perf",
        "invariants.json",
        "ge-canvas-1-conformance.json",
        "coverage.xml",
        "mutation.json",
    }
    if not bundle.exists():
        pytest.skip("artefacts/m2-gate/ not built in this run -- see build_m2_gate_bundle.sh")
    present = {p.name for p in bundle.iterdir()}
    missing = required - present
    assert not missing, f"gate bundle missing: {sorted(missing)}"


def test_no_continue_on_error_on_gate_jobs() -> None:
    """AC-7: no M2 gate job may be marked `continue-on-error` -- weakening a
    gate is never a valid fix (git-safety.md). Checks the CI config
    directly rather than trusting a comment.
    """
    workflow = yaml.safe_load(_CI_WORKFLOW.read_text())
    jobs = workflow["jobs"]
    missing = [name for name in _GATE_JOBS if name not in jobs]
    assert not missing, f"gate jobs missing from ci.yml: {missing}"
    offenders = [name for name in _GATE_JOBS if jobs[name].get("continue-on-error")]
    assert not offenders, f"gate jobs marked continue-on-error: {offenders}"

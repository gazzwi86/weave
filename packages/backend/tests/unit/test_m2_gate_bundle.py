"""CE-V1-TASK-030 (AC-6/AC-7): the M2 gate-bundle + gate-config meta-tests.

Pure filesystem/YAML checks -- no docker, no network (Law F). AC-1's
isolation suite lives in `tests/integration/test_m2_release_gate.py`
because it needs the real docker-compose stack; these two stay unit-speed.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

_REPO_ROOT = Path(__file__).resolve().parents[4]
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

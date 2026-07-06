"""BE-TASK-008 (build-engine EPIC-008): the 5 M1 safety gates (AC-3), run in
order by `GATE_PIPELINE` -- secret-scan, SAST, type-check, package-existence,
delta-scoped mutation. Each gate function returns a `GateResult` on pass or
raises `GateFailure` on fail; `service.generate_app` runs them atomically
(first failure aborts, nothing committed).

Law F: `subprocess.run` is the only external-tool boundary here (Bandit,
Semgrep, mypy, tsc, mutmut) -- tests patch it at this module's import, never
shelling out for real.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from weave_backend.build.model_routing import ALLOWED_MODELS
from weave_backend.generation.package_checker import check_package_existence
from weave_backend.generation.secret_scanner import scan_for_secrets

#: Pseudocode compares `mutation_result.score < 0.70` -- a 0..1 fraction,
#: not a 0..100 percentage (AC-5's own test seeds a 0.65 score).
MUTATION_THRESHOLD = 0.70


def _resolved(tool: str) -> str:
    """Resolve `tool` to an absolute path via `PATH` (falling back to the
    bare name if not found on this machine) -- closes the PATH-hijack gap
    S607 warns about, rather than merely suppressing the warning.
    """
    return shutil.which(tool) or tool

#: Loose enough to catch a placeholder/invented id (e.g. "claude-4-opus"),
#: narrow enough to skip unrelated "claude-*" prose in comments/READMEs.
_MODEL_ID_PATTERN = re.compile(r"claude-[a-z0-9][a-z0-9-]*")
_SCANNED_SUFFIXES = (".py", ".ts", ".tsx", ".json", ".yaml", ".yml")


@dataclass(frozen=True)
class GateResult:
    gate: str
    status: str = "PASS"
    score: float | None = None


class GateFailure(Exception):
    """Raised by any gate on failure. `error` is the AC-3 error code
    (`secret_scan_fail` | `sast_fail` | `type_check_fail` |
    `package_existence_fail` | `mutation_gate_fail`); `evidence` holds the
    response-body extras (`hits`/`evidence`/`surviving_mutants`/`score`).
    """

    def __init__(self, error: str, **evidence: object) -> None:
        super().__init__(error)
        self.error = error
        self.evidence = evidence


def run_secret_scan_gate(workspace: str) -> GateResult:
    hits = scan_for_secrets(workspace)
    if hits:
        raise GateFailure("secret_scan_fail", hits=hits)
    return GateResult(gate="secret_scan")


def find_unconfirmed_model_ids(workspace: str) -> list[str]:
    """AC-7: any `claude-*`-shaped string in generated code that isn't one
    of the confirmed model ids is a SAST-pattern violation.
    """
    found: set[str] = set()
    for path in Path(workspace).rglob("*"):
        if path.is_file() and path.suffix in _SCANNED_SUFFIXES:
            found.update(_MODEL_ID_PATTERN.findall(path.read_text(errors="ignore")))
    return sorted(found - ALLOWED_MODELS)


def run_sast_gate(workspace: str) -> GateResult:
    # Fixed argv naming the exact tools Law F mandates (Bandit, Semgrep);
    # `workspace` is our own tempdir, never user-supplied.
    bandit_result = subprocess.run(
        [_resolved("bandit"), "-r", workspace, "-ll"], capture_output=True, text=True, check=False
    )
    semgrep_result = subprocess.run(
        [_resolved("semgrep"), "--config=auto", workspace],
        capture_output=True,
        text=True,
        check=False,
    )
    unconfirmed = find_unconfirmed_model_ids(workspace)
    if bandit_result.returncode != 0 or semgrep_result.returncode != 0 or unconfirmed:
        evidence = (bandit_result.stderr or "") + (semgrep_result.stderr or "")
        if unconfirmed:
            evidence += f" unconfirmed model ids: {unconfirmed}"
        raise GateFailure("sast_fail", evidence=evidence)
    return GateResult(gate="sast")


def run_type_check_gate(workspace: str) -> GateResult:
    # Fixed argv naming the exact tools Law F mandates (mypy, tsc);
    # `workspace` is our own tempdir, never user-supplied.
    mypy_result = subprocess.run(
        [_resolved("mypy"), f"{workspace}/backend", "--strict"],
        capture_output=True,
        text=True,
        check=False,
    )
    tsc_result = subprocess.run(
        [_resolved("tsc"), "--noEmit", "--project", f"{workspace}/frontend"],
        capture_output=True,
        text=True,
        check=False,
    )
    if mypy_result.returncode != 0 or tsc_result.returncode != 0:
        evidence = (mypy_result.stderr or "") + (tsc_result.stderr or "")
        raise GateFailure("type_check_fail", evidence=evidence)
    return GateResult(gate="type_check")


def run_package_existence_gate(workspace: str) -> GateResult:
    unresolved = check_package_existence(workspace)
    if unresolved:
        raise GateFailure("package_existence_fail", unresolved=unresolved)
    return GateResult(gate="package_existence")


@dataclass(frozen=True)
class MutationResult:
    score: float
    survivors: list[dict[str, object]]


def run_delta_mutation(workspace: str) -> MutationResult:
    """AC-5: mutation score on the delta (changed files) only -- scoped via
    `--paths-to-mutate {workspace}/backend`, never the full codebase.
    """
    # Fixed argv naming the exact tool Law F mandates (mutmut); `workspace`
    # is our own tempdir, never user-supplied.
    result = subprocess.run(
        [_resolved("mutmut"), "run", "--paths-to-mutate", f"{workspace}/backend"],
        capture_output=True,
        text=True,
        cwd=workspace,
        check=False,
    )
    stats = json.loads(result.stdout) if result.stdout else {}
    killed = stats.get("killed", 0)
    survived = stats.get("survived", 0)
    total = killed + survived
    score = (killed / total) if total else 0.0
    return MutationResult(score=score, survivors=stats.get("survivors", []))


def run_mutation_gate(workspace: str) -> GateResult:
    result = run_delta_mutation(workspace)
    if result.score < MUTATION_THRESHOLD:
        raise GateFailure(
            "mutation_gate_fail", score=result.score, surviving_mutants=result.survivors
        )
    return GateResult(gate="mutation", score=result.score)


#: AC-3's fixed gate order -- secret-scan first (cheapest, fail-fast on
#: worst-case risk), mutation last (most expensive).
GATE_PIPELINE: tuple[Callable[[str], GateResult], ...] = (
    run_secret_scan_gate,
    run_sast_gate,
    run_type_check_gate,
    run_package_existence_gate,
    run_mutation_gate,
)

"""BE-SDK-1 (TASK-004) AC-7 -- validators run over the staging directory as
part of generation itself, not as an optional warning (ADR-006 SS3): a
validator failure is a generation failure.
"""

from __future__ import annotations

import os
import shutil
import subprocess  # nosec B404 -- validator invocation is the point (tsc/mypy), Law F local-only
from pathlib import Path

import yaml

from weave_backend.sdkgen.errors import GenerationValidationError

#: ponytail: resolved from the frontend workspace's installed TypeScript
#: rather than adding a `node`/`npm` runtime dependency to the Python
#: package -- override with WEAVE_TSC_BIN once the generator ships its own
#: pinned TS toolchain image (ADR-006 SS1, "same Fargate family as the
#: preview deployer").
_DEFAULT_TSC_RELATIVE = "../../../../frontend/node_modules/.bin/tsc"
_OPENAPI_REQUIRED_KEYS = ("openapi", "info", "paths", "components")


def _resolve_tsc() -> str:
    override = os.environ.get("WEAVE_TSC_BIN")
    if override:
        return override
    default = (Path(__file__).resolve().parent / _DEFAULT_TSC_RELATIVE).resolve()
    return str(default)


def validate_typescript(ts_dir: Path) -> None:
    """AC-7: ``tsc --noEmit`` over the emitted TS staging dir."""
    tsc = _resolve_tsc()
    result = subprocess.run(  # noqa: S603 # nosec B603 -- fixed argv, no shell, no untrusted input
        [tsc, "--noEmit", "--project", str(ts_dir / "tsconfig.json")],
        cwd=ts_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise GenerationValidationError("tsc --noEmit", result.stdout + result.stderr)


def validate_python(py_dir: Path) -> None:
    """AC-7: ``mypy --strict`` over the emitted Python staging dir."""
    mypy = shutil.which("mypy") or "mypy"
    result = subprocess.run(  # noqa: S603 # nosec B603 -- fixed argv, no shell, no untrusted input
        [mypy, "--strict", "."],
        cwd=py_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise GenerationValidationError("mypy --strict", result.stdout + result.stderr)


def validate_openapi(openapi_path: Path) -> None:
    """AC-7 "OpenAPI 3.1 schema lint".

    ponytail: structural lint (safe_load + required top-level keys +
    ``openapi: 3.1.x`` version check), not a full JSON-Schema-of-OpenAPI
    validator -- no ``openapi-spec-validator`` dependency exists in this
    codebase yet. Upgrade path: swap this function's body for that
    library's `validate()` if a real OpenAPI consumer needs stricter
    conformance than "well-formed YAML with the required sections".
    """
    try:
        doc = yaml.safe_load(openapi_path.read_text())
    except yaml.YAMLError as exc:
        raise GenerationValidationError("openapi-lint", f"invalid YAML: {exc}") from exc
    if not isinstance(doc, dict):
        raise GenerationValidationError("openapi-lint", "document root is not a mapping")
    missing = [k for k in _OPENAPI_REQUIRED_KEYS if k not in doc]
    if missing:
        raise GenerationValidationError("openapi-lint", f"missing top-level keys: {missing}")
    if not str(doc.get("openapi", "")).startswith("3.1"):
        raise GenerationValidationError(
            "openapi-lint", f"openapi version must be 3.1.x, got {doc.get('openapi')!r}"
        )


def validate_staging(staging: Path) -> None:
    """Runs all three AC-7 validators in the pseudocode's fixed order."""
    validate_typescript(staging / "ts")
    validate_python(staging / "py")
    validate_openapi(staging / "openapi" / "openapi.yaml")

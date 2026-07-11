"""TASK-004 (BE-SDK-1) OpenAPI 3.1 emitter tests.

AC-7's real proof for a codegen task is that the emitted output is
actually well-formed and passes the structural OpenAPI lint --
``test_emitted_openapi_passes_schema_lint`` parses and validates the real
emitted YAML file (via ``validate_openapi``), not a string comparison.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from weave_backend.sdkgen.emit_openapi import emit_openapi
from weave_backend.sdkgen.ir import SdkModel
from weave_backend.sdkgen.validate import validate_openapi


def test_emit_openapi_writes_openapi_yaml(tmp_path: Path, sample_sdk_model: SdkModel) -> None:
    emit_openapi(sample_sdk_model, tmp_path)

    assert (tmp_path / "openapi.yaml").exists()


def test_emit_openapi_projects_classes_functions_pin(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    emit_openapi(sample_sdk_model, tmp_path)
    doc = yaml.safe_load((tmp_path / "openapi.yaml").read_text())

    assert doc["openapi"] == "3.1.0"
    assert doc["info"]["version"] == "urn:weave:ce:v1"
    assert "Process" in doc["components"]["schemas"]
    assert doc["components"]["schemas"]["Process"]["required"] == ["label", "tags"]
    assert "/graph/process" in doc["paths"]
    assert "/graph/apply" in doc["paths"]


def test_emit_openapi_is_byte_identical_across_runs(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    """AC-1: yaml.safe_dump(sort_keys=True) gives deterministic output
    regardless of dict insertion order.
    """
    first_dir = tmp_path / "first"
    second_dir = tmp_path / "second"

    emit_openapi(sample_sdk_model, first_dir)
    emit_openapi(sample_sdk_model, second_dir)

    assert (first_dir / "openapi.yaml").read_bytes() == (second_dir / "openapi.yaml").read_bytes()


def test_emitted_openapi_passes_schema_lint(tmp_path: Path, sample_sdk_model: SdkModel) -> None:
    """The codegen task's real test: emitted OpenAPI actually parses and
    passes the AC-7 structural lint against the real emitted file.
    """
    emit_openapi(sample_sdk_model, tmp_path)

    validate_openapi(tmp_path / "openapi.yaml")  # raises GenerationValidationError on failure

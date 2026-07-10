"""TASK-004 (BE-SDK-1) TypeScript emitter tests.

AC-7's real proof for a codegen task is that the emitted output actually
compiles -- ``test_emitted_typescript_passes_tsc_noemit`` shells out to the
real project ``tsc --noEmit`` (via ``validate_typescript``), not a string
comparison against expected source text.
"""

from __future__ import annotations

from pathlib import Path

from weave_backend.sdkgen.emit_typescript import emit_typescript
from weave_backend.sdkgen.ir import SdkModel
from weave_backend.sdkgen.validate import validate_typescript


def test_emit_typescript_writes_index_errors_and_tsconfig(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    emit_typescript(sample_sdk_model, tmp_path)

    assert (tmp_path / "index.ts").exists()
    assert (tmp_path / "errors.ts").exists()
    assert (tmp_path / "tsconfig.json").exists()


def test_emit_typescript_renders_class_field_function_and_query(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    emit_typescript(sample_sdk_model, tmp_path)
    index_ts = (tmp_path / "index.ts").read_text()

    assert "export interface Process" in index_ts
    assert "label: string;" in index_ts
    assert "tags: string[];" in index_ts
    assert "description?: string;" in index_ts
    assert "calculateTotal(amount: number, currency?: string): number" in index_ts
    assert "NotExecutableUntilPostV1(\"weave:calculateTotal\")" in index_ts
    assert "activeProcesses(): Promise<ActiveProcessesRow[]>" in index_ts


def test_emit_typescript_is_byte_identical_across_runs(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    """AC-1: same IR in, same bytes out -- no wall-clock timestamp, no
    dict-ordering leak.
    """
    first_dir = tmp_path / "first"
    second_dir = tmp_path / "second"

    emit_typescript(sample_sdk_model, first_dir)
    emit_typescript(sample_sdk_model, second_dir)

    for name in ("index.ts", "errors.ts", "tsconfig.json"):
        assert (first_dir / name).read_bytes() == (second_dir / name).read_bytes()


def test_emitted_typescript_passes_tsc_noemit(tmp_path: Path, sample_sdk_model: SdkModel) -> None:
    """The codegen task's real test: emitted TS actually compiles under the
    project's real ``tsc --noEmit``, not a string-shaped guess.
    """
    emit_typescript(sample_sdk_model, tmp_path)

    validate_typescript(tmp_path)  # raises GenerationValidationError on failure

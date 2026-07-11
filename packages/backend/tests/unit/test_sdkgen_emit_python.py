"""TASK-004 (BE-SDK-1) Python emitter tests.

AC-7's real proof for a codegen task is that the emitted output actually
type-checks -- ``test_emitted_python_passes_mypy_strict`` shells out to the
real project ``mypy --strict`` (via ``validate_python``), not a string
comparison against expected source text.
"""

from __future__ import annotations

from pathlib import Path

from weave_backend.sdkgen.emit_python import emit_python
from weave_backend.sdkgen.ir import IRFunction, SdkModel
from weave_backend.sdkgen.validate import validate_python


def test_emit_python_writes_all_five_modules(tmp_path: Path, sample_sdk_model: SdkModel) -> None:
    emit_python(sample_sdk_model, tmp_path)

    for name in ("__init__.py", "models.py", "errors.py", "client.py", "theme.py"):
        assert (tmp_path / name).exists()


def test_emit_python_renders_class_field_function_and_query(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    emit_python(sample_sdk_model, tmp_path)
    models_py = (tmp_path / "models.py").read_text()
    client_py = (tmp_path / "client.py").read_text()

    assert "class Process(BaseModel):" in models_py
    assert "label: str" in models_py
    assert "tags: list[str] = Field(min_length=1)" in models_py
    assert "description: str | None = None" in models_py
    assert "def calculateTotal(" in client_py
    assert "amount: float, currency: str | None = None" in client_py
    assert 'raise NotExecutableUntilPostV1("weave:calculateTotal")' in client_py
    assert "def activeProcesses(self) -> list[ActiveProcessesRow]:" in client_py


def test_emit_python_is_byte_identical_across_runs(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    """AC-1: same IR in, same bytes out."""
    first_dir = tmp_path / "first"
    second_dir = tmp_path / "second"

    emit_python(sample_sdk_model, first_dir)
    emit_python(sample_sdk_model, second_dir)

    for name in ("__init__.py", "models.py", "errors.py", "client.py", "theme.py"):
        assert (first_dir / name).read_bytes() == (second_dir / name).read_bytes()


def test_emitted_python_passes_mypy_strict(tmp_path: Path, sample_sdk_model: SdkModel) -> None:
    """The codegen task's real test: emitted Python actually type-checks
    under the project's real ``mypy --strict``, not a string-shaped guess.
    """
    emit_python(sample_sdk_model, tmp_path)

    validate_python(tmp_path)  # raises GenerationValidationError on failure


def test_emitted_python_does_not_let_fn_iri_break_out_of_string_literal(
    tmp_path: Path, sample_sdk_model: SdkModel
) -> None:
    """QA edge case (TASK-004 security check): same injection vector as the
    TypeScript emitter (see ``test_sdkgen_emit_typescript.py``) --
    ``client.py.j2`` interpolates ``fn.fn_iri`` unescaped inside a
    double-quoted Python string
    (``raise NotExecutableUntilPostV1("{{ fn.fn_iri }}")``). A crafted
    ``fn_iri`` containing a quote breaks out of the literal and injects an
    arbitrary statement that still passes ``mypy --strict`` (AC-7 does not
    catch this -- the injected code is itself well-typed Python).
    """
    payload = 'weave:x"); pwned = __import__("os").system("id"); ("'
    poisoned_fn = IRFunction(
        name="safeName", fn_iri=payload, params=[], return_ts="number", return_py="int"
    )
    model = sample_sdk_model.model_copy(update={"functions": [poisoned_fn]})

    emit_python(model, tmp_path)
    client_py = (tmp_path / "client.py").read_text()

    assert 'pwned = __import__("os")' not in client_py, (
        "fn_iri injected an executable statement into the emitted SDK -- "
        "emit_python.py must escape/validate fn.fn_iri before interpolating "
        "it into a Python string literal (see QA failure report TASK-004)"
    )

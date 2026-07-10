"""TASK-004 (BE-SDK-1) integration tests -- ``generate_sdk`` pipeline
orchestration (fetch -> IR -> emit -> validate -> stage). Docker/integration
marked because the happy-path tests run the real ``tsc --noEmit`` /
``mypy --strict`` toolchain over emitted output (same convention as the
unit-level emitter tests, just exercised end to end through the pipeline
entry point rather than a single emitter).

CE is always a fully offline ``httpx.MockTransport`` stub (Law F -- never a
real network call to another engine); no ``platform_stack`` (postgres/
localstack) dependency -- this pipeline has no database or AWS surface.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

from weave_backend.sdkgen import emit_typescript as emit_typescript_module
from weave_backend.sdkgen.ce_client import CeClient
from weave_backend.sdkgen.errors import CeFetchError, GenerationValidationError
from weave_backend.sdkgen.ir import CeVersionPin
from weave_backend.sdkgen.pipeline import generate_sdk

pytestmark = [pytest.mark.integration, pytest.mark.docker]

_PIN = CeVersionPin(version_iri="urn:weave:ce:v1")

_SHAPES_TTL = """
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .

weave:ProcessShape a sh:NodeShape ;
    sh:targetClass weave:Process ;
    sh:property [ sh:path weave:label ; sh:datatype xsd:string ;
                  sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path weave:tags ; sh:datatype xsd:string ; sh:minCount 1 ] ;
    sh:property [ sh:path weave:description ; sh:datatype xsd:string ; sh:maxCount 1 ] .
"""

_FUNCTIONS = [{"fn_iri": "weave:calculateTotal"}, {"fn_iri": "weave:countItems"}]

_FUNCTION_SCHEMAS = {
    "weave:calculateTotal": {
        "name": "calculateTotal",
        "fn_iri": "weave:calculateTotal",
        "parameters": {
            "properties": {"amount": {"type": "number"}, "currency": {"type": "string"}},
            "required": ["amount"],
        },
        "returns": {"type": "number"},
    },
    "weave:countItems": {
        "name": "countItems",
        "fn_iri": "weave:countItems",
        "parameters": {"properties": {"label": {"type": "string"}}, "required": ["label"]},
        "returns": {"type": "integer"},
    },
}

_TOKENS = {"color": {"bg": "#0a0a0a"}, "typography": {}, "spacing": {}, "radius": {}}

_POISONED_TEMPLATES_DIR = Path(__file__).parent / "fixtures" / "sdkgen_poisoned_templates"
_GOLDEN_DIR = Path(__file__).parent / "fixtures" / "sdkgen_golden"


def _handler(
    fail_paths: frozenset[str] = frozenset(),
) -> Callable[[httpx.Request], httpx.Response]:
    def handle(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path in fail_paths:
            return httpx.Response(503)
        if path == "/api/ontology/shapes":
            return httpx.Response(200, text=_SHAPES_TTL)
        if path == "/api/ontology/named-selects":
            return httpx.Response(200, json={"selects": []})
        if path == "/api/functions":
            return httpx.Response(200, json={"functions": _FUNCTIONS})
        if path.startswith("/api/functions/"):
            fn_iri = path.removeprefix("/api/functions/")
            return httpx.Response(200, json=_FUNCTION_SCHEMAS[fn_iri])
        if path == "/api/brand/tokens":
            return httpx.Response(200, json=_TOKENS)
        raise AssertionError(f"unexpected CE stub path: {path}")

    return handle


def _stub_client(fail_paths: frozenset[str] = frozenset()) -> CeClient:
    transport = httpx.MockTransport(_handler(fail_paths))
    return CeClient(httpx.Client(transport=transport, base_url="https://ce.test"))


def _tree_files(root: Path) -> dict[str, bytes]:
    return {
        str(path.relative_to(root)): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def test_generate_sdk_matches_committed_golden_fixture() -> None:
    """AC-1: pinned CE inputs emit a staging tree byte-identical to the
    committed golden fixture (tests/integration/fixtures/sdkgen_golden/) --
    catches template regressions that two live runs, being equally
    regressed, would not.
    """
    staging = generate_sdk(_PIN, _stub_client())

    assert _tree_files(staging) == _tree_files(_GOLDEN_DIR)


def test_generate_sdk_emits_one_typed_method_per_registry_function() -> None:
    """AC-4: the CE-FUNCTION-1 registry fixture has two functions; the
    emitted TS and Python clients get one typed method each.
    """
    staging = generate_sdk(_PIN, _stub_client())

    index_ts = (staging / "ts" / "index.ts").read_text()
    client_py = (staging / "py" / "client.py").read_text()
    for name in ("calculateTotal", "countItems"):
        assert f"{name}(" in index_ts
        assert f"def {name}(" in client_py


def test_generate_sdk_fails_atomically_naming_unreachable_input(tmp_path: Path) -> None:
    """AC-6: a fetch failure raises before any staging directory exists --
    proven here by pointing ``tempfile``'s temp dir at an empty, isolated
    directory and asserting it stays empty.
    """
    stub = _stub_client(fail_paths=frozenset({"/api/brand/tokens"}))

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("tempfile.gettempdir", lambda: str(tmp_path))
        with pytest.raises(CeFetchError) as exc_info:
            generate_sdk(_PIN, stub)

    assert "CE-BRAND-1 tokens" in str(exc_info.value)
    assert list(tmp_path.iterdir()) == []


def test_generate_sdk_fails_generation_when_emitted_ts_does_not_compile(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """AC-7: a poisoned TypeScript template is caught by ``tsc --noEmit``,
    not silently emitted -- and the staging dir it was caught in doesn't
    survive the failure (nothing partial lands).
    """
    monkeypatch.setattr(emit_typescript_module, "_TEMPLATES_DIR", _POISONED_TEMPLATES_DIR)
    monkeypatch.setattr("tempfile.gettempdir", lambda: str(tmp_path))

    with pytest.raises(GenerationValidationError) as exc_info:
        generate_sdk(_PIN, _stub_client())

    assert exc_info.value.validator == "tsc --noEmit"
    assert list(tmp_path.iterdir()) == []

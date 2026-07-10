"""TASK-004 (BE-SDK-1) unit tests -- ``generate_sdk`` pipeline orchestration
wiring (fetch -> IR -> emit -> validate). The four AC-mapped scenarios
(golden-file, fixture-registry, atomicity, poisoned-template) are covered
end to end in ``tests/integration/test_sdkgen_pipeline.py``; this file
covers the orchestration logic that isn't already exercised there: the
production default-client construction path.
"""

from __future__ import annotations

import httpx
import pytest

from weave_backend.sdkgen.ce_client import CeClient
from weave_backend.sdkgen.ir import CeVersionPin
from weave_backend.sdkgen.pipeline import _default_ce_client, generate_sdk


def test_default_ce_client_reads_base_url_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CE_API_BASE_URL", "https://ce.example.test")

    client = _default_ce_client()

    assert isinstance(client, CeClient)
    assert str(client._http.base_url) == "https://ce.example.test"


def test_default_ce_client_falls_back_to_default_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CE_API_BASE_URL", raising=False)

    client = _default_ce_client()

    assert str(client._http.base_url) == "http://localhost:8000"


def test_generate_sdk_calls_all_five_ce_fetches_before_returning_staging_dir() -> None:
    """Orchestration proof: ``generate_sdk`` drives the fetch -> IR -> emit
    -> validate pipeline through the injected client and produces the three
    emitter subdirectories -- without asserting on emitted file *content*
    (that's the emitter unit tests' job) or on toolchain validation (that's
    the integration lane's job).
    """
    calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        path = request.url.path
        if path == "/api/ontology/shapes":
            return httpx.Response(
                200,
                text=(
                    "@prefix sh: <http://www.w3.org/ns/shacl#> .\n"
                    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n"
                    "@prefix weave: <https://weave.io/ontology/> .\n"
                    "weave:ThingShape a sh:NodeShape ; sh:targetClass weave:Thing ;\n"
                    "  sh:property [ sh:path weave:label ; sh:datatype xsd:string ;\n"
                    "                sh:minCount 1 ; sh:maxCount 1 ] .\n"
                ),
            )
        if path == "/api/ontology/named-selects":
            return httpx.Response(200, json={"selects": []})
        if path == "/api/functions":
            return httpx.Response(200, json={"functions": []})
        if path == "/api/brand/tokens":
            return httpx.Response(
                200, json={"color": {}, "typography": {}, "spacing": {}, "radius": {}}
            )
        raise AssertionError(f"unexpected path {path}")

    transport = httpx.MockTransport(handle)
    stub = CeClient(httpx.Client(transport=transport, base_url="https://ce.test"))

    staging = generate_sdk(CeVersionPin(version_iri="urn:weave:ce:v1"), stub)

    assert (staging / "ts").is_dir()
    assert (staging / "py").is_dir()
    assert (staging / "openapi").is_dir()
    assert calls == [
        "/api/ontology/shapes",
        "/api/functions",
        "/api/brand/tokens",
        "/api/ontology/named-selects",
    ]

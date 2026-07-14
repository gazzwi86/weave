"""PLAT-V1-TASK-017: `_completeness`'s gap rows carry a `kind` tag so
role-home's completeness map (AC-3) can attribute a gap to the kind it
came from without a second SPARQL round-trip or a hand-copied pairing.
Additive-only change to TASK-016's binding -- existing `entity_iri`/
`missing_link` keys are untouched.
"""

from __future__ import annotations

import httpx
import pytest
from httpx import MockTransport, Request, Response

from weave_backend.dashboard import bindings as bindings


def _ce_stub() -> httpx.AsyncClient:
    def _handler(request: Request) -> Response:
        if request.url.path == "/api/metrics/ontology":
            return Response(200, json={"entity_count_by_kind": {"Process": 1}})
        if request.url.path == "/api/sparql":
            body = request.content.decode()
            kind = "Process" if "weave:Process" in body else "BusinessCapability"
            return Response(
                200,
                json={"rows": [{"entity_iri": f"urn:{kind.lower()}:1", "missing_link": "x"}]},
            )
        return Response(404)

    return httpx.AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


@pytest.mark.asyncio
async def test_completeness_gaps_carry_kind_tag(monkeypatch: pytest.MonkeyPatch) -> None:
    class _StubConn:
        pass

    ctx = bindings.BindingContext(
        tenant_id="t-1",
        context_iri="urn:weave:tenant:t-1:company",
        conn=_StubConn(),
        ce_client=_ce_stub(),
        # PR #91 hardening: coverage_gap now fails closed without a
        # forwarded Authorization header.
        ce_headers={"Authorization": "Bearer test-binding-token"},
    )
    result = await bindings._completeness(ctx)
    kinds = {gap["kind"] for gap in result.rows["gaps"]}
    assert kinds == {"Process", "BusinessCapability"}

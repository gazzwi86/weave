"""TASK-004 (BE-SDK-1) unit tests -- CeClient fetch adapter. AC-6's
"named the failing input" contract is proven here at the single-call
level; the pipeline-level "no partial staging output" half of AC-6 is
proven in the integration suite.
"""

from __future__ import annotations

import httpx
import pytest

from weave_backend.sdkgen.ce_client import CeClient
from weave_backend.sdkgen.errors import CeFetchError


def _client(handler: httpx.MockTransport) -> CeClient:
    return CeClient(httpx.Client(transport=handler, base_url="https://ce.test"))


def test_shapes_returns_turtle_text() -> None:
    handler = httpx.MockTransport(lambda req: httpx.Response(200, text="@prefix sh: <x> ."))
    assert _client(handler).shapes("urn:v1") == "@prefix sh: <x> ."


def test_functions_returns_list() -> None:
    handler = httpx.MockTransport(
        lambda req: httpx.Response(200, json={"functions": [{"fn_iri": "urn:fn:a"}]})
    )
    assert _client(handler).functions() == [{"fn_iri": "urn:fn:a"}]


def test_brand_tokens_returns_dict() -> None:
    handler = httpx.MockTransport(lambda req: httpx.Response(200, json={"color": {}}))
    assert _client(handler).brand_tokens() == {"color": {}}


def test_unreachable_input_raises_ce_fetch_error_naming_it() -> None:
    handler = httpx.MockTransport(lambda req: httpx.Response(503))
    with pytest.raises(CeFetchError) as exc_info:
        _client(handler).brand_tokens()
    assert "CE-BRAND-1 tokens" in str(exc_info.value)

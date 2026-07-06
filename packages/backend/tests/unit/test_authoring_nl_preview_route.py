"""CE-TASK-006 AC-006-02/-03: `POST /api/ontology/authoring/nl` gains an
optional `preview` flag so the chat panel can show the modeller the parsed
operation batch and wait for confirmation *before* anything is dispatched
to CE-WRITE-1. Default (`preview=False`) is unchanged from TASK-004 --
these tests isolate only the new branch, at the route-function level (no
DB), mirroring `tests/unit/test_ontology_router.py`'s style.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from weave_backend.auth.dependencies import Principal
from weave_backend.routers import authoring
from weave_backend.schemas.authoring import NlAuthoringRequest
from weave_backend.schemas.operations import AddNodeOp, ApplyRequest, ApplyResponse

PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")

_PARSED = ApplyRequest(
    operations=[AddNodeOp(op="add_node", ref="p1", kind="Process", label="Customer Onboarding")],
    actor=PRINCIPAL.principal_iri,
)


async def test_preview_true_returns_operations_without_dispatching() -> None:
    body = NlAuthoringRequest(text="Add a Process called Customer Onboarding", preview=True)

    with (
        patch.object(authoring, "parse_operations", return_value=_PARSED),
        patch.object(authoring, "_dispatch", new_callable=AsyncMock) as dispatch,
    ):
        response = await authoring.nl_authoring_route(body, PRINCIPAL)

    dispatch.assert_not_called()
    assert isinstance(response, JSONResponse)
    assert response.status_code == 200
    payload = bytes(response.body).decode()
    assert '"op":"add_node"' in payload
    assert '"kind":"Process"' in payload


async def test_preview_false_dispatches_as_before() -> None:
    body = NlAuthoringRequest(text="Add a Process called Customer Onboarding", preview=False)
    dispatched = ApplyResponse(activity_iri="urn:a", applied_count=1, version_iri="urn:v")

    with (
        patch.object(authoring, "parse_operations", return_value=_PARSED),
        patch.object(authoring, "_dispatch", new_callable=AsyncMock) as dispatch,
    ):
        dispatch.return_value = dispatched
        response = await authoring.nl_authoring_route(body, PRINCIPAL)

    dispatch.assert_awaited_once_with(PRINCIPAL, _PARSED.operations)
    assert response == dispatched


async def test_provider_unreachable_returns_502_not_a_raw_exception() -> None:
    """FIX 3: no WEAVE_MODEL_PROVIDER graceful-degradation path existed for
    the authoring NL route -- unlike nl_query/translator.py (which has a
    canned-fallback boundary), a provider outage (Ollama host down, no
    Anthropic/Bedrock creds) propagated straight past this route as an
    unhandled exception. Must surface as a clean 502, not a traceback.
    """
    body = NlAuthoringRequest(text="Add a Process called Customer Onboarding")

    with (
        patch.object(authoring, "parse_operations", side_effect=httpx.ConnectError("refused")),
        pytest.raises(HTTPException) as exc_info,
    ):
        await authoring.nl_authoring_route(body, PRINCIPAL)

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == {"error": "model_provider_unavailable"}  # type: ignore[comparison-overlap]

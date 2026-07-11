"""TASK-010 unit tests: `GET /api/sparql?pattern=authority|escalation|
coverage_gap` -- the parameterised pattern branch, isolated from real
Postgres/Oxigraph the same way `test_sparql_pattern_route.py` isolates
`pattern=coverage_gap_process`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from contextlib import ExitStack, asynccontextmanager, contextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.operations import versioning
from weave_backend.rdf import agent_grounding
from weave_backend.routers import sparql
from weave_backend.routers.sparql import PatternGroundingParams
from weave_backend.settings.resolver import SettingNotFound

PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
V1 = "urn:weave:tenant:t1:ws:ws-1:v0.1.0"
ACTOR = "https://weave.io/instances/agent-1"
TARGET = "https://weave.io/instances/process-1"
PROCESS = "https://weave.io/instances/process-2"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[object]:
    yield object()


def _version() -> versioning.GraphVersion:
    return versioning.GraphVersion(
        version_iri=V1,
        semver="0.1.0",
        status="published",
        created_at=datetime.now(UTC),
        published_at=datetime.now(UTC),
        actor_iri=PRINCIPAL.principal_iri,
        workspace_id="ws-1",
    )


@contextmanager
def _graph_resolution_patched() -> Iterator[None]:
    with ExitStack() as stack:
        stack.enter_context(patch.object(sparql, "tenant_connection", _fake_tenant_connection))
        stack.enter_context(patch.object(versioning, "resolve_version", AsyncMock(return_value=V1)))
        stack.enter_context(
            patch.object(versioning, "get_version", AsyncMock(return_value=_version()))
        )
        stack.enter_context(
            patch.object(sparql, "enforce_workspace_role", AsyncMock(return_value=None))
        )
        stack.enter_context(
            patch.object(
                agent_grounding, "resolve_setting", AsyncMock(side_effect=SettingNotFound("k"))
            )
        )
        yield


def _bindings(*rows: dict[str, str | None]) -> dict[str, object]:
    """Builds a fake SPARQL JSON-results body from `{var: value|None}`
    rows -- `None` means the var is unbound in that row (rdflib/Oxigraph
    both omit unbound vars from the binding dict).
    """
    out = []
    for row in rows:
        binding = {k: {"type": "literal", "value": v} for k, v in row.items() if v is not None}
        out.append(binding)
    var_names = sorted({k for row in rows for k in row})
    return {"head": {"vars": var_names}, "results": {"bindings": out}}


class TestAuthorityPattern:
    @pytest.mark.asyncio
    async def test_missing_params_is_a_400(self) -> None:
        with _graph_resolution_patched(), pytest.raises(HTTPException) as exc_info:
            await sparql._pattern_response(
                PRINCIPAL, pattern="authority", workspace_id="ws-1", version="latest"
            )
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "missing_authority_params"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_modelled_link_denies_never_permits(self) -> None:
        results = _bindings({"entity_iri": TARGET, "missing_link": None, "source": "modelled"})
        with (
            _graph_resolution_patched(),
            patch.object(sparql, "run_query", AsyncMock(return_value=results)),
        ):
            body = await sparql._pattern_response(
                PRINCIPAL,
                pattern="authority",
                workspace_id="ws-1",
                version="latest",
                grounding=PatternGroundingParams(actor=ACTOR, action="performedBy", target=TARGET),
            )
        assert body["decision"] == "deny"
        assert body["rows"][0]["source"] == "modelled"

    @pytest.mark.asyncio
    async def test_absent_link_is_a_coverage_gap(self) -> None:
        results = _bindings(
            {"entity_iri": TARGET, "missing_link": "performedBy", "source": "coverage_gap"}
        )
        with (
            _graph_resolution_patched(),
            patch.object(sparql, "run_query", AsyncMock(return_value=results)),
        ):
            body = await sparql._pattern_response(
                PRINCIPAL,
                pattern="authority",
                workspace_id="ws-1",
                version="latest",
                grounding=PatternGroundingParams(actor=ACTOR, action="performedBy", target=TARGET),
            )
        assert body["decision"] == "coverage-gap"

    @pytest.mark.asyncio
    async def test_invalid_action_is_a_400(self) -> None:
        with _graph_resolution_patched(), pytest.raises(HTTPException) as exc_info:
            await sparql._pattern_response(
                PRINCIPAL,
                pattern="authority",
                workspace_id="ws-1",
                version="latest",
                grounding=PatternGroundingParams(
                    actor=ACTOR, action="deletesEverything", target=TARGET
                ),
            )
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "invalid_action"}  # type: ignore[comparison-overlap]


class TestEscalationPattern:
    @pytest.mark.asyncio
    async def test_missing_process_param_is_a_400(self) -> None:
        with _graph_resolution_patched(), pytest.raises(HTTPException) as exc_info:
            await sparql._pattern_response(
                PRINCIPAL, pattern="escalation", workspace_id="ws-1", version="latest"
            )
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "missing_escalation_params"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_no_performed_by_actor_is_a_coverage_gap(self) -> None:
        results = _bindings(
            {
                "entity_iri": PROCESS,
                "actor_iri": None,
                "missing_link": "performedBy",
                "source": "coverage_gap",
            }
        )
        with (
            _graph_resolution_patched(),
            patch.object(sparql, "run_query", AsyncMock(return_value=results)),
        ):
            body = await sparql._pattern_response(
                PRINCIPAL,
                pattern="escalation",
                workspace_id="ws-1",
                version="latest",
                grounding=PatternGroundingParams(process=PROCESS),
            )
        assert body["decision"] == "coverage-gap"


class TestCoverageGapPattern:
    @pytest.mark.asyncio
    async def test_default_invocation_uses_process_performed_by_governed_by(self) -> None:
        results = _bindings({"entity_iri": TARGET, "missing_link": "governedBy"})
        with (
            _graph_resolution_patched(),
            patch.object(sparql, "run_query", AsyncMock(return_value=results)) as mock_run,
        ):
            body = await sparql._pattern_response(
                PRINCIPAL, pattern="coverage_gap", workspace_id="ws-1", version="latest"
            )
        sent_query = mock_run.call_args.args[0]
        assert "weave:Process" in sent_query
        assert "weave:performedBy" in sent_query
        assert "weave:governedBy" in sent_query
        assert body["decision"] == "coverage-gap"

    @pytest.mark.asyncio
    async def test_no_gap_rows_denies(self) -> None:
        results = _bindings()
        with (
            _graph_resolution_patched(),
            patch.object(sparql, "run_query", AsyncMock(return_value=results)),
        ):
            body = await sparql._pattern_response(
                PRINCIPAL, pattern="coverage_gap", workspace_id="ws-1", version="latest"
            )
        assert body["decision"] == "deny"

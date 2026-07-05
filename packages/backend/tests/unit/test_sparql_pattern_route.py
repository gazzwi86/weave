"""CE-TASK-007 unit tests: `GET /api/sparql?pattern=<name>` -- the named
stored-query path (AC-007-12/-13), isolated from real Postgres/Oxigraph the
same way `test_sparql_router.py` isolates the `query=` path.
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
from weave_backend.routers import sparql

PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
V1 = "urn:weave:tenant:t1:ws:ws-1:v0.1.0"


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
        yield


class TestResolvePatternQuery:
    def test_unknown_pattern_name_raises_400(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            sparql._resolve_pattern_query("no_such_pattern")

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "unknown_pattern"}  # type: ignore[comparison-overlap]

    def test_known_pattern_name_returns_its_query_text(self) -> None:
        query_text = sparql._resolve_pattern_query("coverage_gap_process")
        assert "coverage_gap" not in query_text  # sanity: it's SPARQL, not a name echo
        assert "weave:Process" in query_text


class TestPatternResponse:
    @pytest.mark.asyncio
    async def test_coverage_gap_with_gap_rows_returns_them_with_no_message(self) -> None:
        bindings = [
            {
                "process_iri": {"type": "uri", "value": "urn:p1"},
                "step_iri": {"type": "uri", "value": "urn:s1"},
                "step_label": {"type": "literal", "value": "Approve"},
                "gap_reason": {"type": "literal", "value": "No actor or system assigned"},
            }
        ]
        with (
            _graph_resolution_patched(),
            patch.object(
                sparql,
                "run_query",
                AsyncMock(
                    return_value={
                        "head": {
                            "vars": ["process_iri", "step_iri", "step_label", "gap_reason"]
                        },
                        "results": {"bindings": bindings},
                    }
                ),
            ),
        ):
            body = await sparql._pattern_response(
                PRINCIPAL, pattern="coverage_gap_process", workspace_id="ws-1", version="latest"
            )

        assert body["rows"] == [
            {
                "process_iri": "urn:p1",
                "step_iri": "urn:s1",
                "step_label": "Approve",
                "gap_reason": "No actor or system assigned",
            }
        ]
        assert "message" not in body

    @pytest.mark.asyncio
    async def test_coverage_gap_with_zero_rows_returns_the_zero_row_message(self) -> None:
        with (
            _graph_resolution_patched(),
            patch.object(
                sparql,
                "run_query",
                AsyncMock(return_value={"head": {"vars": []}, "results": {"bindings": []}}),
            ),
        ):
            body = await sparql._pattern_response(
                PRINCIPAL, pattern="coverage_gap_process", workspace_id="ws-1", version="latest"
            )

        assert body == {
            "rows": [],
            "column_names": [],
            "message": "No coverage gaps found",
        }

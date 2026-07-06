"""CE-TASK-003 unit tests: `routers/sparql.py`'s new `GET /api/sparql` route
-- version resolution, pagination, and `since_version` diff shape -- isolated
from real Postgres/Oxigraph.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.operations import diff, versioning
from weave_backend.operations.diff import DiffResult, Triple
from weave_backend.routers import sparql

PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")

V1 = "urn:weave:tenant:t1:ws:ws-1:v0.1.0"
V2 = "urn:weave:tenant:t1:ws:ws-1:v0.1.1"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[object]:
    yield object()


def _version(*, version_iri: str, workspace_id: str = "ws-1") -> versioning.GraphVersion:
    return versioning.GraphVersion(
        version_iri=version_iri,
        semver="0.1.0",
        status="published",
        created_at=datetime.now(UTC),
        published_at=datetime.now(UTC),
        actor_iri=PRINCIPAL.principal_iri,
        workspace_id=workspace_id,
    )


class TestResolveQueryGraph:
    @pytest.mark.asyncio
    async def test_resolves_latest_alias_to_the_versions_own_graph(self) -> None:
        with (
            patch.object(sparql, "tenant_connection", _fake_tenant_connection),
            patch.object(
                versioning, "resolve_version", AsyncMock(return_value=V1)
            ) as resolve_version,
            patch.object(
                versioning, "get_version", AsyncMock(return_value=_version(version_iri=V1))
            ),
            patch.object(sparql, "enforce_workspace_role", AsyncMock(return_value=None)),
        ):
            graph_iri = await sparql._resolve_query_graph(
                PRINCIPAL, workspace_id="ws-1", version="latest"
            )

        assert graph_iri == V1
        assert resolve_version.call_args.kwargs == {
            "tenant_id": "t1",
            "workspace_id": "ws-1",
            "version": "latest",
        }

    @pytest.mark.asyncio
    async def test_unknown_version_alias_404s(self) -> None:
        with (
            patch.object(sparql, "tenant_connection", _fake_tenant_connection),
            patch.object(
                versioning,
                "resolve_version",
                AsyncMock(side_effect=versioning.VersionNotFound("nope")),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await sparql._resolve_query_graph(PRINCIPAL, workspace_id="ws-1", version="latest")

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == {"error": "version_not_found"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_unknown_explicit_version_iri_404s(self) -> None:
        """AC-003-09: `resolve_version` passes an explicit (non-"latest")
        version_iri through unchanged -- existence is `get_version`'s job.
        """
        with (
            patch.object(sparql, "tenant_connection", _fake_tenant_connection),
            patch.object(versioning, "resolve_version", AsyncMock(return_value="urn:bogus")),
            patch.object(versioning, "get_version", AsyncMock(return_value=None)),
            pytest.raises(HTTPException) as exc_info,
        ):
            await sparql._resolve_query_graph(PRINCIPAL, workspace_id="ws-1", version="urn:bogus")

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == {"error": "version_not_found"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_authorizes_against_the_versions_real_workspace(self) -> None:
        """XT-003: a version_iri may belong to a different workspace than the
        caller-supplied one -- the read must be authorized against the
        version's REAL workspace_id, never the caller-supplied one.
        """
        with (
            patch.object(sparql, "tenant_connection", _fake_tenant_connection),
            patch.object(versioning, "resolve_version", AsyncMock(return_value=V1)),
            patch.object(
                versioning,
                "get_version",
                AsyncMock(return_value=_version(version_iri=V1, workspace_id="ws-real")),
            ),
            patch.object(sparql, "enforce_workspace_role", AsyncMock(return_value=None)) as role,
        ):
            await sparql._resolve_query_graph(
                PRINCIPAL, workspace_id="ws-caller-supplied", version="latest"
            )

        assert role.call_args.kwargs["workspace_id"] == "ws-real"

    @pytest.mark.asyncio
    async def test_no_active_workspace_400s(self) -> None:
        with (
            patch.object(sparql, "get_active_workspace", AsyncMock(return_value=None)),
            pytest.raises(HTTPException) as exc_info,
        ):
            await sparql._resolve_query_graph(PRINCIPAL, workspace_id=None, version="latest")

        assert exc_info.value.status_code == 400


class TestPaginateBindings:
    def test_first_page_of_a_small_result_set_has_no_next(self) -> None:
        bindings = [{"s": {"value": str(i)}} for i in range(5)]
        page_bindings, has_next = sparql._paginate_bindings(bindings, page=1)
        assert page_bindings == bindings
        assert has_next is False

    def test_result_set_over_1000_rows_is_split_with_a_next_flag(self) -> None:
        bindings = [{"s": {"value": str(i)}} for i in range(1500)]
        page_bindings, has_next = sparql._paginate_bindings(bindings, page=1)
        assert len(page_bindings) == 1000
        assert has_next is True

        second_page, has_next_2 = sparql._paginate_bindings(bindings, page=2)
        assert len(second_page) == 500
        assert has_next_2 is False


class TestSparqlSelectRoute:
    @pytest.mark.asyncio
    async def test_select_query_returns_bindings_from_the_resolved_graph(self) -> None:
        from fastapi import Response

        response = Response()
        fake_results = {"head": {"vars": ["s"]}, "results": {"bindings": [{"s": {"value": "x"}}]}}
        with (
            patch.object(
                sparql, "_resolve_query_graph", AsyncMock(return_value=V1)
            ) as resolve_graph,
            patch.object(sparql, "run_query", AsyncMock(return_value=fake_results)) as run_query,
        ):
            body = await sparql.sparql_select_route(
                PRINCIPAL,
                response,
                sparql.SparqlQueryParams(
                    query="SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }",
                    version="latest",
                    page=1,
                    workspace_id="ws-1",
                    since_version=None,
                ),
            )

        resolve_graph.assert_awaited_once_with(PRINCIPAL, workspace_id="ws-1", version="latest")
        run_query.assert_awaited_once_with(
            "SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }", V1
        )
        assert body["results"]["bindings"] == [{"s": {"value": "x"}}]
        assert "Link" not in response.headers

    @pytest.mark.asyncio
    async def test_insert_query_is_rejected_with_the_ac_003_05_prohibited_clause_shape(
        self,
    ) -> None:
        """AC-003-05: the router's rejection body names the exact clause
        (`{error: "prohibited_clause", clause: "INSERT"}`), not the generic
        `disallowed_query` the parent `DisallowedQueryError` case reports --
        `ProhibitedClauseError` must be caught ahead of its parent class.
        """
        from fastapi import Response

        with pytest.raises(HTTPException) as exc_info:
            await sparql.sparql_select_route(
                PRINCIPAL,
                Response(),
                sparql.SparqlQueryParams(
                    query="INSERT DATA { GRAPH <urn:g> { <urn:s> <urn:p> <urn:o> } }",
                    version="latest",
                    page=1,
                    workspace_id="ws-1",
                    since_version=None,
                ),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "prohibited_clause", "clause": "INSERT"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_service_query_is_rejected_with_the_ac_003_06_service_blocked_shape(
        self,
    ) -> None:
        """AC-003-06: SERVICE (SSRF vector) gets its own distinct error
        shape, not the generic `disallowed_query`.
        """
        from fastapi import Response

        with pytest.raises(HTTPException) as exc_info:
            await sparql.sparql_select_route(
                PRINCIPAL,
                Response(),
                sparql.SparqlQueryParams(
                    query=(
                        "SELECT ?s WHERE { GRAPH ?g { SERVICE <http://evil.example/sparql> "
                        "{ ?s ?p ?o } } }"
                    ),
                    version="latest",
                    page=1,
                    workspace_id="ws-1",
                    since_version=None,
                ),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "service_blocked"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_select_query_missing_entirely_is_a_400(self) -> None:
        from fastapi import Response

        with pytest.raises(HTTPException) as exc_info:
            await sparql.sparql_select_route(
                PRINCIPAL,
                Response(),
                sparql.SparqlQueryParams(
                    query=None, version="latest", page=1, workspace_id="ws-1", since_version=None
                ),
            )

        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_since_version_returns_a_diff_instead_of_running_a_query(self) -> None:
        from fastapi import Response

        diff_result = DiffResult(
            added=[Triple(subject="s", predicate="p", object="o")], removed=[], modified=[]
        )
        with (
            patch.object(
                sparql, "_resolve_query_graph", AsyncMock(side_effect=[V1, V2])
            ) as resolve_graph,
            patch.object(diff, "compute_diff", AsyncMock(return_value=diff_result)) as compute_diff,
        ):
            body = await sparql.sparql_select_route(
                PRINCIPAL,
                Response(),
                sparql.SparqlQueryParams(
                    query=None, version="latest", page=1, workspace_id="ws-1", since_version=V1
                ),
            )

        assert resolve_graph.await_count == 2
        compute_diff.assert_awaited_once_with(V1, V2)
        assert body["added"] == [{"subject": "s", "predicate": "p", "object": "o"}]
        assert body["removed"] == []
        assert body["since_version"] == V1
        assert body["version_iri"] == V2


class TestRunSparqlRoute:
    """`POST /api/sparql` -- CE-READ-1's other write-shaped-body entry point.
    No prior unit coverage existed for this route at all.
    """

    @pytest.mark.asyncio
    async def test_insert_query_is_rejected_with_the_ac_003_05_prohibited_clause_shape(
        self,
    ) -> None:
        from weave_backend.schemas.sparql import SparqlQueryRequest

        with (
            patch.object(sparql, "_resolve_named_graph", AsyncMock(return_value=V1)),
            pytest.raises(HTTPException) as exc_info,
        ):
            await sparql.run_sparql_route(
                SparqlQueryRequest(
                    query="INSERT DATA { GRAPH <urn:g> { <urn:s> <urn:p> <urn:o> } }"
                ),
                PRINCIPAL,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "prohibited_clause", "clause": "INSERT"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_service_query_is_rejected_with_the_ac_003_06_service_blocked_shape(
        self,
    ) -> None:
        from weave_backend.schemas.sparql import SparqlQueryRequest

        with (
            patch.object(sparql, "_resolve_named_graph", AsyncMock(return_value=V1)),
            pytest.raises(HTTPException) as exc_info,
        ):
            await sparql.run_sparql_route(
                SparqlQueryRequest(
                    query=(
                        "SELECT ?s WHERE { GRAPH ?g { SERVICE <http://evil.example/sparql> "
                        "{ ?s ?p ?o } } }"
                    )
                ),
                PRINCIPAL,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "service_blocked"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_modify_statement_is_rejected_with_the_generic_update_clause_shape(
        self,
    ) -> None:
        """QA edge case (AC-003-05): a `DELETE {...} INSERT {...} WHERE {...}`
        Modify form is neither a pure INSERT nor a pure DELETE, so
        `query_rewriter._UPDATE_CLAUSE_LABELS` has no entry for it and it
        falls back to the generic `"UPDATE"` label
        (`_DEFAULT_UPDATE_CLAUSE_LABEL`). `test_query_rewriter.py` proves
        this at the `validate_query` unit level, but neither `TestSparqlSelectRoute`
        nor this class had proven the fallback label survives the router's
        `_validate_or_400` -> `ProhibitedClauseError` -> HTTPException path
        end-to-end -- only the two labelled cases (INSERT, SERVICE) were.
        """
        from weave_backend.schemas.sparql import SparqlQueryRequest

        with (
            patch.object(sparql, "_resolve_named_graph", AsyncMock(return_value=V1)),
            pytest.raises(HTTPException) as exc_info,
        ):
            await sparql.run_sparql_route(
                SparqlQueryRequest(
                    query=(
                        "DELETE { GRAPH <urn:g> { ?s ?p ?o } } "
                        'INSERT { GRAPH <urn:g> { ?s ?p "y" } } '
                        "WHERE { GRAPH <urn:g> { ?s ?p ?o } }"
                    )
                ),
                PRINCIPAL,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "prohibited_clause", "clause": "UPDATE"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_valid_select_runs_against_the_resolved_graph(self) -> None:
        from weave_backend.schemas.sparql import SparqlQueryRequest

        fake_results = {"head": {"vars": ["s"]}, "results": {"bindings": [{"s": {"value": "x"}}]}}
        with (
            patch.object(sparql, "_resolve_named_graph", AsyncMock(return_value=V1)),
            patch.object(sparql, "run_query", AsyncMock(return_value=fake_results)) as run_query,
        ):
            body = await sparql.run_sparql_route(
                SparqlQueryRequest(query="SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }"),
                PRINCIPAL,
            )

        run_query.assert_awaited_once_with(
            "SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }", V1
        )
        assert body == fake_results

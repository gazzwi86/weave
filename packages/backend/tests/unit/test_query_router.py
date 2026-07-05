"""CE-TASK-007 unit tests: `POST /api/query/nl` and `POST /api/query/explain`
-- translation-failure/sanitiser/unanswerable handling, isolated from real
Postgres/Oxigraph the same way `test_sparql_router.py` isolates
`GET /api/sparql`. `translate_to_sparql`/`explain_*` are patched directly
(Law F: no real Bedrock/Anthropic call reaches these tests).
"""

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.nl_query.translator import TranslationFailed
from weave_backend.routers import query
from weave_backend.schemas.query import ExplainQueryRequest, NlQueryRequest

PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
V1 = "urn:weave:tenant:t1:ws:ws-1:v0.1.0"

_GRAPH_QUERY = (
    "PREFIX weave: <https://weave.io/ontology/>\n"
    "SELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . } }"
)


def _patched_graph_resolution() -> Any:
    return patch.object(query, "_resolve_query_graph", AsyncMock(return_value=V1))


class TestNlQueryRouteTranslationFailure:
    @pytest.mark.asyncio
    async def test_translation_failed_returns_400_with_the_question(self) -> None:
        with patch.object(
            query, "translate_to_sparql", side_effect=TranslationFailed("asdkjfh nonsense")
        ), pytest.raises(HTTPException) as exc_info:
            await query.nl_query_route(
                NlQueryRequest(question="asdkjfh nonsense"), PRINCIPAL
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
            "error": "translation_failed",
            "nl_question": "asdkjfh nonsense",
        }

    @pytest.mark.asyncio
    async def test_unparseable_model_output_is_also_reported_as_translation_failed(self) -> None:
        """AC-007-05: the model's output failed even `validate_query`'s
        parse (garbage text) -- the model's fault, not a malicious query --
        so this maps to the same `translation_failed` shape, never a raw
        parser message.
        """
        with (
            patch.object(query, "translate_to_sparql", return_value="not sparql at all $$$"),
            pytest.raises(HTTPException) as exc_info,
        ):
            await query.nl_query_route(NlQueryRequest(question="huh?"), PRINCIPAL)

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["error"] == "translation_failed"  # type: ignore[index]

    @pytest.mark.asyncio
    async def test_question_text_is_never_logged_at_info_or_above(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        caplog.set_level(logging.INFO)
        with patch.object(
            query, "translate_to_sparql", side_effect=TranslationFailed("secret business plan")
        ), pytest.raises(HTTPException):
            await query.nl_query_route(
                NlQueryRequest(question="secret business plan"), PRINCIPAL
            )

        assert "secret business plan" not in caplog.text


class TestNlQueryRouteSanitiser:
    @pytest.mark.asyncio
    async def test_nl_generated_delete_clause_is_rejected_as_prohibited(self) -> None:
        with patch.object(
            query, "translate_to_sparql", return_value="DELETE WHERE { ?s ?p ?o }"
        ), pytest.raises(HTTPException) as exc_info:
            await query.nl_query_route(
                NlQueryRequest(question="delete everything"), PRINCIPAL
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "prohibited_clause", "clause": "DELETE"}  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_nl_generated_service_clause_is_blocked(self) -> None:
        service_query = (
            "SELECT ?s WHERE { GRAPH ?g { SERVICE <http://evil.example/sparql> { ?s ?p ?o } } }"
        )
        with (
            patch.object(query, "translate_to_sparql", return_value=service_query),
            pytest.raises(HTTPException) as exc_info,
        ):
            await query.nl_query_route(
                NlQueryRequest(question="ask another endpoint"), PRINCIPAL
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == {"error": "service_blocked"}  # type: ignore[comparison-overlap]


class TestNlQueryRouteUnanswerable:
    @pytest.mark.asyncio
    async def test_empty_result_includes_a_plain_language_explanation(self) -> None:
        with (
            patch.object(query, "translate_to_sparql", return_value=_GRAPH_QUERY),
            _patched_graph_resolution(),
            patch.object(
                query,
                "run_query",
                AsyncMock(return_value={"head": {"vars": ["p"]}, "results": {"bindings": []}}),
            ),
            patch.object(
                query, "explain_empty_result", return_value="Out of scope for this schema."
            ) as explain_empty,
        ):
            response = await query.nl_query_route(
                NlQueryRequest(question="What flying cars does Weave sell?"), PRINCIPAL
            )

        assert response.rows == []
        assert response.explanation == "Out of scope for this schema."
        assert explain_empty.call_count == 1

    @pytest.mark.asyncio
    async def test_non_empty_result_has_no_explanation(self) -> None:
        bindings = [{"p": {"type": "uri", "value": "urn:p1"}}]
        with (
            patch.object(query, "translate_to_sparql", return_value=_GRAPH_QUERY),
            _patched_graph_resolution(),
            patch.object(
                query,
                "run_query",
                AsyncMock(
                    return_value={"head": {"vars": ["p"]}, "results": {"bindings": bindings}}
                ),
            ),
            patch.object(query, "explain_empty_result") as explain_empty,
        ):
            response = await query.nl_query_route(
                NlQueryRequest(question="What processes exist?"), PRINCIPAL
            )

        assert response.rows == [{"p": "urn:p1"}]
        assert response.explanation is None
        assert explain_empty.call_count == 0


class TestNlQueryRouteResponseShape:
    @pytest.mark.asyncio
    async def test_response_includes_generated_sparql_and_elapsed_ms(self) -> None:
        with (
            patch.object(query, "translate_to_sparql", return_value=_GRAPH_QUERY),
            _patched_graph_resolution(),
            patch.object(
                query,
                "run_query",
                AsyncMock(
                    return_value={
                        "head": {"vars": ["p"]},
                        "results": {"bindings": [{"p": {"type": "uri", "value": "urn:p1"}}]},
                    }
                ),
            ),
        ):
            response = await query.nl_query_route(
                NlQueryRequest(question="What processes exist?"), PRINCIPAL
            )

        assert response.sparql_generated == _GRAPH_QUERY
        assert response.elapsed_ms >= 0
        assert response.next_page is None

    @pytest.mark.asyncio
    async def test_more_than_page_size_rows_reports_a_next_page(self) -> None:
        bindings = [{"p": {"type": "uri", "value": f"urn:p{i}"}} for i in range(1001)]
        with (
            patch.object(query, "translate_to_sparql", return_value=_GRAPH_QUERY),
            _patched_graph_resolution(),
            patch.object(
                query,
                "run_query",
                AsyncMock(
                    return_value={"head": {"vars": ["p"]}, "results": {"bindings": bindings}}
                ),
            ),
        ):
            response = await query.nl_query_route(
                NlQueryRequest(question="What processes exist?"), PRINCIPAL
            )

        assert len(response.rows) == 1000
        assert response.next_page == 2


class TestExplainQueryRoute:
    @pytest.mark.asyncio
    async def test_returns_the_models_explanation(self) -> None:
        with patch.object(query, "explain_query", return_value="Finds every Process.") as explain:
            response = await query.explain_query_route(
                ExplainQueryRequest(sparql=_GRAPH_QUERY), PRINCIPAL
            )

        assert response.explanation == "Finds every Process."
        assert explain.call_args.args[0] == _GRAPH_QUERY

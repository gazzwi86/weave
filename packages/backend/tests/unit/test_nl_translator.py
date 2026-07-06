"""CE-TASK-007 unit tests: `nl_query/translator.py` -- NL->SPARQL prompt
construction, output cleanup, and failure classification (AC-007-05).
`ai.router.route` is always injected via `provider=` (Law F -- never a real
Bedrock/Anthropic call in tests).
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from weave_backend.nl_query.translator import (
    TranslationFailed,
    bpmo_schema_context,
    explain_empty_result,
    explain_query,
    translate_to_sparql,
)


def _provider(response_text: str) -> MagicMock:
    provider = MagicMock()
    provider.complete.return_value = response_text
    return provider


class TestBpmoSchemaContext:
    def test_includes_kind_labels_and_relationship_names_only(self) -> None:
        """Context-compression note (Implementation Hints): only kind +
        relationship *names* are injected, never graph triples.
        """
        context = bpmo_schema_context()

        assert "Process" in context["kinds"]
        assert "performedBy" in context["relationships"]


class TestTranslateToSparql:
    def test_returns_the_models_sparql_text(self) -> None:
        provider = _provider(
            'SELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . } }'
        )

        sparql_text = translate_to_sparql("What processes exist?", provider=provider)

        assert "SELECT ?p" in sparql_text
        assert provider.complete.call_count == 1

    def test_strips_markdown_code_fencing_from_the_models_output(self) -> None:
        provider = _provider(
            '```sparql\nSELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . } }\n```'
        )

        sparql_text = translate_to_sparql("What processes exist?", provider=provider)

        assert "```" not in sparql_text
        assert sparql_text.startswith("SELECT")

    def test_empty_model_output_raises_translation_failed(self) -> None:
        provider = _provider("   ")

        with pytest.raises(TranslationFailed) as exc_info:
            translate_to_sparql("asdkjfh nonsense", provider=provider)

        assert exc_info.value.nl_question == "asdkjfh nonsense"

    def test_prompt_includes_the_question_and_the_schema_context(self) -> None:
        provider = _provider("SELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . } }")

        translate_to_sparql("What processes does Customer own?", provider=provider)

        sent_prompt = provider.complete.call_args.args[1]
        assert "What processes does Customer own?" in sent_prompt
        assert "Process" in sent_prompt

    def test_provider_failure_degrades_to_a_canned_query_instead_of_raising(self) -> None:
        """The demo must never hard-crash on query -- no ANTHROPIC_API_KEY
        set / Ollama host unreachable both raise from `route()`."""
        provider = MagicMock()
        provider.complete.side_effect = RuntimeError("no auth method / connection refused")

        sparql_text = translate_to_sparql("What processes exist?", provider=provider)

        assert "GRAPH ?g" in sparql_text
        assert "weave:Process" in sparql_text

    def test_canned_fallback_matches_a_process_keyword(self) -> None:
        provider = MagicMock()
        provider.complete.side_effect = RuntimeError("unreachable")

        sparql_text = translate_to_sparql("List all processes", provider=provider)

        assert "weave:Process" in sparql_text

    def test_canned_fallback_matches_an_actor_keyword(self) -> None:
        provider = MagicMock()
        provider.complete.side_effect = RuntimeError("unreachable")

        sparql_text = translate_to_sparql("Who are the actors?", provider=provider)

        assert "weave:Actor" in sparql_text

    def test_canned_fallback_defaults_to_show_everything_for_an_unmatched_question(self) -> None:
        provider = MagicMock()
        provider.complete.side_effect = RuntimeError("unreachable")

        sparql_text = translate_to_sparql("What is the meaning of life?", provider=provider)

        assert sparql_text == (
            "SELECT ?subject ?predicate ?object WHERE { GRAPH ?g { ?subject ?predicate ?object } }"
        )


class TestExplainQuery:
    def test_returns_the_models_explanation_text(self) -> None:
        provider = _provider("This finds every Process and its label.")

        explanation = explain_query(
            "SELECT ?p ?l WHERE { GRAPH ?g { ?p weave:label ?l } }", provider=provider
        )

        assert explanation == "This finds every Process and its label."

    def test_provider_failure_degrades_to_a_canned_explanation_instead_of_raising(self) -> None:
        provider = MagicMock()
        provider.complete.side_effect = RuntimeError("unreachable")

        explanation = explain_query(
            "SELECT ?p WHERE { GRAPH ?g { ?p a weave:Process } }", provider=provider
        )

        assert "not available" in explanation.lower() or "reachable" in explanation.lower()


class TestExplainEmptyResult:
    def test_returns_a_plain_language_explanation_of_the_empty_result(self) -> None:
        provider = _provider("No processes matched 'flying cars' -- out of scope.")

        explanation = explain_empty_result(
            "What flying cars does Weave sell?",
            "SELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . FILTER(false) } }",
            provider=provider,
        )

        assert "out of scope" in explanation

    def test_provider_failure_degrades_to_a_canned_explanation_instead_of_raising(self) -> None:
        provider = MagicMock()
        provider.complete.side_effect = RuntimeError("unreachable")

        explanation = explain_empty_result(
            "What flying cars does Weave sell?",
            "SELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . FILTER(false) } }",
            provider=provider,
        )

        assert "not available" in explanation.lower() or "reachable" in explanation.lower()

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


class TestExplainQuery:
    def test_returns_the_models_explanation_text(self) -> None:
        provider = _provider("This finds every Process and its label.")

        explanation = explain_query(
            "SELECT ?p ?l WHERE { GRAPH ?g { ?p weave:label ?l } }", provider=provider
        )

        assert explanation == "This finds every Process and its label."


class TestExplainEmptyResult:
    def test_returns_a_plain_language_explanation_of_the_empty_result(self) -> None:
        provider = _provider("No processes matched 'flying cars' -- out of scope.")

        explanation = explain_empty_result(
            "What flying cars does Weave sell?",
            "SELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . FILTER(false) } }",
            provider=provider,
        )

        assert "out of scope" in explanation

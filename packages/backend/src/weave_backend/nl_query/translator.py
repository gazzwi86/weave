"""CE-TASK-007 E7-S1/E7-S2: NL question -> SPARQL SELECT translation
(AC-007-01/-05) and on-demand plain-language explanations (AC-007-04/-14).

claude-sonnet-5 is given the BPMO kind/relationship *schema* (never raw
graph triples -- Implementation Hints' context-compression note) and must
emit ONLY a SPARQL SELECT, no code-fencing. This module never trusts that
output as safe to execute: the caller (`routers/query.py`) always runs it
through `rdf/query_rewriter.validate_query` -- the same choke point every
other SPARQL path goes through -- before `run_query` ever sees it
(AC-007-02).
"""

from __future__ import annotations

import re

from weave_backend.ai.providers import ModelProvider
from weave_backend.ai.router import route
from weave_backend.ontology import catalogue

_TIER = "sonnet"
_FENCE_RE = re.compile(r"^```(?:sparql)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


class TranslationFailed(Exception):
    """AC-007-05: the model produced no usable SPARQL text at all -- the
    route reports `{error: "translation_failed", nl_question: ...}`, never
    a raw parser exception. A structurally-parseable-but-prohibited clause
    (INSERT/DELETE/SERVICE) is a *different* case (AC-007-02,
    `prohibited_clause`/`service_blocked`), handled by the caller via
    `query_rewriter`'s own exception types.
    """

    def __init__(self, nl_question: str) -> None:
        super().__init__(f"could not translate question to SPARQL: {nl_question!r}")
        self.nl_question = nl_question


def _local_name(iri: str) -> str:
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def bpmo_schema_context() -> dict[str, list[str]]:
    """Kind + relationship *names* only (never graph triples) -- keeps the
    prompt small regardless of tenant data size (Implementation Hints).
    Introspected live from the SHACL shapes graph, never a hand-copied list
    (ontology-standards.md).
    """
    kinds = catalogue.list_kinds()
    relationships = catalogue.list_relationships(kinds)
    return {
        "kinds": sorted({kind.label for kind in kinds}),
        "relationships": sorted({_local_name(rel.path) for rel in relationships}),
    }


def _translation_prompt(question: str) -> str:
    schema = bpmo_schema_context()
    return (
        "Translate the question into a single SPARQL 1.1 SELECT query over "
        "the BPMO schema below. Output ONLY the SPARQL query text -- no "
        "explanation, no markdown code fencing. The query MUST wrap its "
        "WHERE clause body in `GRAPH ?g { ... }` (a variable, not a "
        "specific IRI) -- dataset scoping is enforced separately.\n\n"
        f"Kinds: {', '.join(schema['kinds'])}\n"
        f"Relationships: {', '.join(schema['relationships'])}\n\n"
        f"Question: {question}"
    )


def translate_to_sparql(question: str, *, provider: ModelProvider | None = None) -> str:
    """Returns raw (unsanitised) SPARQL text -- the caller MUST run it
    through `query_rewriter.validate_query` before execution (AC-007-02).
    Never logs `question` (DoD: NL question text must not be logged at
    INFO+ -- business-sensitive).
    """
    raw = route(_TIER, _translation_prompt(question), provider=provider)
    sparql_text = _FENCE_RE.sub("", raw).strip()
    if not sparql_text:
        raise TranslationFailed(question)
    return sparql_text


def explain_query(sparql_text: str, *, provider: ModelProvider | None = None) -> str:
    """AC-007-14: on-demand plain-language explanation of an arbitrary
    (already-sanitised) SPARQL query -- a separate LLM call from
    translation, never invoked automatically.
    """
    prompt = (
        "Explain what the following SPARQL query does, in plain language, "
        f"for a non-technical business analyst:\n\n{sparql_text}"
    )
    return route(_TIER, prompt, provider=provider)


def explain_empty_result(
    nl_question: str, sparql_text: str, *, provider: ModelProvider | None = None
) -> str:
    """AC-007-04: when a translated question's query legitimately returns
    zero rows, explain why in plain language (out-of-scope question, no
    matching data, etc.) instead of a bare empty response.
    """
    prompt = (
        f"The question '{nl_question}' was translated into the SPARQL "
        f"query below, which returned no results:\n\n{sparql_text}\n\n"
        "In one or two plain-language sentences, explain why there are no "
        "results -- for example because the question is out of scope for "
        "this schema, or because no matching data currently exists."
    )
    return route(_TIER, prompt, provider=provider)

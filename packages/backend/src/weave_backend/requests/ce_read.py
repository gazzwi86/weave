"""CE-READ-1 blast-radius + stakeholder-authority queries (BE-TASK-004,
build-engine EPIC-001).

ponytail: CE-READ-1's concrete BPMO predicates for "touches domain" /
"touches service" / "has authority over" aren't specced yet -- all three of
this task's Diagram References are acknowledged DoR blockers (ADR-002
follows ADR-001's precedent: a transparent, documented M1 scope-cut, not an
escalation). The placeholder predicate IRIs below are real SPARQL that runs
today against Oxigraph and is a one-line swap once BPMO ships the real
predicates -- same precedent as `requests/pipeline.py`'s `GROUNDING_QUERY`.
"""

from __future__ import annotations

import re

import httpx

from weave_backend.rdf.oxigraph_client import run_query_unscoped

_IRI_PATTERN = re.compile(r"urn:weave:[a-zA-Z0-9:_-]+")

#: ponytail: placeholder BPMO predicates -- see module docstring.
_TOUCHES_DOMAIN = "urn:weave:bpmo:touchesDomain"
_TOUCHES_SERVICE = "urn:weave:bpmo:touchesService"
_HAS_AUTHORITY = "urn:weave:bpmo:hasAuthority"


class CeReadUnavailable(Exception):
    """CE-READ-1 unreachable -- callers degrade to AC-2's `"unavailable"`
    shape, never a 5xx.
    """


def extract_entity_iris(draft_content: dict[str, str] | None) -> list[str]:
    """AC-1: every `urn:weave:...` IRI mentioned across the drafted
    sections, de-duplicated, first-seen order.
    """
    if not draft_content:
        return []
    seen: dict[str, None] = {}
    for text in draft_content.values():
        for match in _IRI_PATTERN.findall(text):
            seen.setdefault(match, None)
    return list(seen)


def _values_clause(entity_iris: list[str]) -> str:
    return " ".join(f"<{iri}>" for iri in entity_iris)


async def compute_blast_radius(entity_iris: list[str]) -> tuple[list[str], list[str]]:
    """AC-1: domains + services touched by `entity_iris`, via one
    `VALUES`-clause query (implementation hint: avoids N+1 CE calls).
    Raises `CeReadUnavailable` if CE-READ-1 can't be reached -- AC-2's
    caller degrades that to a `200`.
    """
    if not entity_iris:
        return [], []
    query = f"""
        SELECT ?domain ?service WHERE {{
          VALUES ?e {{ {_values_clause(entity_iris)} }}
          OPTIONAL {{ ?e <{_TOUCHES_DOMAIN}> ?domain }}
          OPTIONAL {{ ?e <{_TOUCHES_SERVICE}> ?service }}
        }}
    """
    try:
        result = await run_query_unscoped(query)
    except httpx.HTTPError as exc:
        raise CeReadUnavailable("CE-READ-1 unreachable") from exc
    bindings = result.get("results", {}).get("bindings", [])
    domains = {b["domain"]["value"] for b in bindings if "domain" in b}
    services = {b["service"]["value"] for b in bindings if "service" in b}
    return sorted(domains), sorted(services)


async def resolve_required_stakeholders(entity_iris: list[str]) -> list[str]:
    """Design-decision table's `hasAuthority` query: every stakeholder IRI
    with authority over any of `entity_iris`. Raises `CeReadUnavailable` on
    connection failure -- not handled by sign-off callers (untested, no AC
    covers a CE outage mid-approval; see ADR-002).
    """
    if not entity_iris:
        return []
    query = f"""
        SELECT DISTINCT ?stakeholder WHERE {{
          VALUES ?e {{ {_values_clause(entity_iris)} }}
          ?stakeholder <{_HAS_AUTHORITY}> ?e .
        }}
    """
    try:
        result = await run_query_unscoped(query)
    except httpx.HTTPError as exc:
        raise CeReadUnavailable("CE-READ-1 unreachable") from exc
    bindings = result.get("results", {}).get("bindings", [])
    return sorted({b["stakeholder"]["value"] for b in bindings})

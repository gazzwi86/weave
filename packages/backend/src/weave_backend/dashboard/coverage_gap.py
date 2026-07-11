"""AC-2 (S2 completeness): the base-framework `coverage_gap(kind,
required_links[])` query (contracts.md CE-READ-1) -- built here as a
parametrised SPARQL SELECT and submitted through the existing
`POST /api/sparql` SELECT-only endpoint (no new CE route -- the
"required per kind" predicate list is named by the caller, never derived
or hard-coded server-side inside CE, per contracts.md).
"""

from __future__ import annotations

from typing import Any

import httpx

_QUERY_TEMPLATE = """
PREFIX weave: <https://weave.io/ontology/>
SELECT ?entity_iri ?missing_link
WHERE {{
  GRAPH ?g {{
    ?entity_iri a weave:{kind} .
    VALUES ?missing_link {{ {link_values} }}
    FILTER NOT EXISTS {{
      ?entity_iri ?p ?target .
      FILTER(STRAFTER(STR(?p), "https://weave.io/ontology/") = STR(?missing_link))
    }}
  }}
}}
"""


def build_query(kind: str, required_links: list[str]) -> str:
    link_values = " ".join(f'"{link}"' for link in required_links)
    return _QUERY_TEMPLATE.format(kind=kind, link_values=link_values)


async def coverage_gap(
    client: httpx.AsyncClient,
    *,
    kind: str,
    required_links: list[str],
    headers: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Returns `{ entity_iri, missing_link }` rows, one per absent link
    (contracts.md CE-READ-1 `coverage_gap` shape).
    """
    query = build_query(kind, required_links)
    response = await client.post("/api/sparql", json={"query": query}, headers=headers)
    response.raise_for_status()
    body = response.json()
    return [
        {"entity_iri": row.get("entity_iri"), "missing_link": row.get("missing_link")}
        for row in body.get("rows", [])
    ]


_CONTRAVENTIONS_QUERY = """
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?entity_iri ?message ?severity
WHERE {
  GRAPH ?g {
    ?result a sh:ValidationResult ;
      sh:focusNode ?entity_iri ;
      sh:resultSeverity ?severity .
    OPTIONAL { ?result sh:resultMessage ?message }
  }
}
"""


async def contraventions(
    client: httpx.AsyncClient, *, headers: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    """S5 (AC-3): SHACL `sh:ValidationResult` rows, each carrying a
    `CE-READ-1` `/resource/{iri}` deep-link href -- reuses the same
    generic `POST /api/sparql` SELECT-only endpoint as `coverage_gap`
    (no new CE route), and the `/resource/{iri}` href convention already
    established by `routers/requests.py`'s grounding-entity links.
    """
    response = await client.post(
        "/api/sparql", json={"query": _CONTRAVENTIONS_QUERY}, headers=headers
    )
    response.raise_for_status()
    body = response.json()
    return [
        {
            "entity_iri": row.get("entity_iri"),
            "message": row.get("message"),
            "severity": row.get("severity"),
            "href": f"/resource/{row.get('entity_iri')}",
        }
        for row in body.get("rows", [])
        if row.get("entity_iri")
    ]

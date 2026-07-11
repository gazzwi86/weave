"""Thin HTTP client for Oxigraph's SPARQL 1.1 protocol + Graph Store
Protocol endpoints (used directly by the app and by tests seeding
per-workspace triples for the isolation check).
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

_TIMEOUT_SECONDS = 5.0

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def oxigraph_url() -> str:
    default_url = f"http://localhost:{os.environ.get('WEAVE_OXIGRAPH_PORT', '7878')}"
    return os.environ.get("OXIGRAPH_URL", default_url)


def _get_client() -> httpx.AsyncClient:
    # ponytail: same loop-binding gotcha fixed in tenancy/sessions.py's
    # redis client and db/pool.py's asyncpg pool -- httpx's asyncio
    # transport is bound to the event loop live when it's created, so a
    # plain module-level singleton would break the second pytest-asyncio
    # test to touch it. Recreate whenever the running loop has changed
    # instead of a fresh client per call (was the fix before this one).
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        _client = httpx.AsyncClient(timeout=_TIMEOUT_SECONDS)
        _client_loop = current_loop
    return _client


async def run_query(query: str, named_graph_iri: str) -> dict[str, Any]:
    """Run `query` against Oxigraph with the RDF dataset restricted to
    `named_graph_iri` (PR #11 finding 1: SPARQL 1.1 Protocol
    default-graph-uri/named-graph-uri params, enforced by Oxigraph against
    the dataset -- not the query text -- so a GRAPH clause naming any other
    graph simply matches nothing, however that IRI was spelled).
    """
    response = await _get_client().get(
        f"{oxigraph_url()}/query",
        params={
            "query": query,
            "default-graph-uri": named_graph_iri,
            "named-graph-uri": named_graph_iri,
        },
        headers={"Accept": "application/sparql-results+json"},
    )
    response.raise_for_status()
    result: dict[str, Any] = response.json()
    return result


async def run_query_multi(query: str, named_graph_iris: list[str]) -> dict[str, Any]:
    """Run `query` with the dataset's *named graphs* restricted to exactly
    `named_graph_iris` -- for queries that reference more than one graph
    explicitly via `GRAPH <iri> { ... }` in the same query (e.g.
    `aggregate_metrics.draft_published_delta`'s cross-graph SPARQL count-diff,
    which needs both the draft graph and the latest-published graph visible
    at once). No `default-graph-uri` is set, so every triple pattern must be
    inside an explicit `GRAPH <iri>` block -- same "unnamed IRI matches
    nothing" rule as `run_query`, just for more than one IRI.
    """
    response = await _get_client().get(
        f"{oxigraph_url()}/query",
        params={"query": query, "named-graph-uri": named_graph_iris},
        headers={"Accept": "application/sparql-results+json"},
    )
    response.raise_for_status()
    result: dict[str, Any] = response.json()
    return result


async def run_query_unscoped(query: str) -> dict[str, Any]:
    """Run `query` against the whole Oxigraph dataset -- every named graph
    unioned into the default graph (`union-default-graph=true`, Oxigraph's
    own non-standard SPARQL-protocol extension) -- rather than `run_query`'s
    single-`named_graph_iri` restriction. BE-TASK-004's blast-radius/
    authority queries key off a `RequestRecord`'s entity IRIs, which have no
    single workspace binding to scope by.
    """
    response = await _get_client().get(
        f"{oxigraph_url()}/query",
        params={"query": query, "union-default-graph": "true"},
        headers={"Accept": "application/sparql-results+json"},
    )
    response.raise_for_status()
    result: dict[str, Any] = response.json()
    return result


async def load_graph(
    named_graph_iri: str, turtle_data: str, *, content_type: str = "text/turtle"
) -> None:
    """PUT triples into a specific named graph via the Graph Store Protocol.

    `content_type` defaults to Turtle; the CE write path (`operations/pipeline.py`)
    passes `application/n-triples` instead -- N-Triples needs no qname/prefix
    computation, which is what made rdflib's Turtle serializer the write-path
    hotspot (see ADR-004 follow-up). Oxigraph stores triples in its own
    internal representation regardless of ingest format, so this has no
    effect on what any `Accept: text/turtle` reader (e.g. `fetch_graph_turtle`)
    gets back.
    """
    response = await _get_client().put(
        f"{oxigraph_url()}/store",
        params={"graph": named_graph_iri},
        headers={"Content-Type": content_type},
        content=turtle_data,
    )
    response.raise_for_status()


async def fetch_graph_turtle(named_graph_iri: str) -> str:
    """GET a graph's full Turtle content (Graph Store Protocol). A graph
    that has never been written returns 404 -- treated as empty, not an
    error, since "clone the working graph" must work on a brand-new
    workspace.
    """
    response = await _get_client().get(
        f"{oxigraph_url()}/store",
        params={"graph": named_graph_iri},
        headers={"Accept": "text/turtle"},
    )
    if response.status_code == 404:
        return ""
    response.raise_for_status()
    return response.text


async def fetch_graph_ntriples(named_graph_iri: str) -> str:
    """GET a graph's content as N-Triples -- same semantics as
    `fetch_graph_turtle` (404 -> empty string) but requests the cheaper wire
    format for the CE write path's clone step, which only needs to round-trip
    through rdflib, not be human-read.
    """
    response = await _get_client().get(
        f"{oxigraph_url()}/store",
        params={"graph": named_graph_iri},
        headers={"Accept": "application/n-triples"},
    )
    if response.status_code == 404:
        return ""
    response.raise_for_status()
    return response.text


async def append_graph(named_graph_iri: str, turtle_data: str) -> None:
    """POST merges triples into a graph (Graph Store Protocol semantics --
    unlike `load_graph`'s PUT, which replaces the whole graph). Used only
    for append-only writes (the PROV-O activity log), never for the
    working graph itself.
    """
    response = await _get_client().post(
        f"{oxigraph_url()}/store",
        params={"graph": named_graph_iri},
        headers={"Content-Type": "text/turtle"},
        content=turtle_data,
    )
    response.raise_for_status()


async def clear_graph(named_graph_iri: str) -> None:
    """DELETE all triples in a specific named graph (test cleanup)."""
    response = await _get_client().delete(
        f"{oxigraph_url()}/store",
        params={"graph": named_graph_iri},
    )
    if response.status_code not in (200, 204, 404):
        response.raise_for_status()

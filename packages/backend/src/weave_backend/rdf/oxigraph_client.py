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


async def load_graph(named_graph_iri: str, turtle_data: str) -> None:
    """PUT triples into a specific named graph via the Graph Store Protocol."""
    response = await _get_client().put(
        f"{oxigraph_url()}/store",
        params={"graph": named_graph_iri},
        headers={"Content-Type": "text/turtle"},
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

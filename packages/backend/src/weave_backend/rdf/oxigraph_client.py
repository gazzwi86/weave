"""Thin HTTP client for Oxigraph's SPARQL 1.1 protocol + Graph Store
Protocol endpoints (used directly by the app and by tests seeding
per-workspace triples for the isolation check).
"""

from __future__ import annotations

import os
from typing import Any

import httpx

_TIMEOUT_SECONDS = 5.0


def oxigraph_url() -> str:
    return os.environ.get("OXIGRAPH_URL", "http://localhost:7878")


async def run_query(query: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        response = await client.get(
            f"{oxigraph_url()}/query",
            params={"query": query},
            headers={"Accept": "application/sparql-results+json"},
        )
        response.raise_for_status()
        result: dict[str, Any] = response.json()
        return result


async def load_graph(named_graph_iri: str, turtle_data: str) -> None:
    """PUT triples into a specific named graph via the Graph Store Protocol."""
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        response = await client.put(
            f"{oxigraph_url()}/store",
            params={"graph": named_graph_iri},
            headers={"Content-Type": "text/turtle"},
            content=turtle_data,
        )
        response.raise_for_status()


async def clear_graph(named_graph_iri: str) -> None:
    """DELETE all triples in a specific named graph (test cleanup)."""
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        response = await client.delete(
            f"{oxigraph_url()}/store",
            params={"graph": named_graph_iri},
        )
        if response.status_code not in (200, 204, 404):
            response.raise_for_status()

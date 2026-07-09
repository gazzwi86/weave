"""HTTP client for CE-READ-1 (``GET /api/ontology/resource/{iri}``,
contracts.md Sec. CE-READ-1) -- AC-1/AC-2's `policy_iri` resolution at
standards-authoring time.

Unlike `briefs/ce_read_client.py`'s `get_bpmo_context` (which collapses a
404 and a transport failure into one `CeReadUnavailable` -> 503), this
client must NOT collapse them (task brief's implementation hint): a 404
means the IRI doesn't resolve at all (AC-1 -> 422 `policy_not_found`); a
connection error or any other non-2xx status means CE-READ-1 itself is
unreachable (AC-2 -> 503 `ce_unavailable`).
"""

from __future__ import annotations

import httpx


class CeReadTransportError(Exception):
    """CE-READ-1 unreachable (connection error) or returned a non-2xx,
    non-404 status -- callers turn this into the 503 ``ce_unavailable``
    response. A standard is never persisted with an unvalidated policy link.
    """


async def get_entity(
    client: httpx.AsyncClient, iri: str, *, headers: dict[str, str] | None = None
) -> dict[str, object] | None:
    """Fetch one entity via CE-READ-1. Returns the entity body (has a
    ``kind`` field) on 200, ``None`` on 404 (the IRI does not resolve to any
    entity), raises :class:`CeReadTransportError` on anything else.
    """
    try:
        response = await client.get(f"/api/ontology/resource/{iri}", headers=headers)
    except httpx.HTTPError as exc:
        raise CeReadTransportError(f"CE-READ-1 unreachable: {exc}") from exc
    if response.status_code == 404:
        return None
    if response.status_code >= 400:
        raise CeReadTransportError(f"CE-READ-1 returned {response.status_code}")
    return dict(response.json())

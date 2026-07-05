"""HTTP client for CE-VERSION-1 (``GET /api/ontology/versions``, contracts.md
Sec. CE-VERSION-1) -- picks the ``is_latest`` entry's ``version_iri`` to pin
a new project to (AC-1).

CE and Build share one FastAPI app for M1 (no separate deployed service
yet), so the default base URL is this same process; ``CE_API_BASE_URL``
overrides it once CE ships as its own deployment -- same env-var-swap
pattern as ``auth/oidc_client.py``'s ``OIDC_ISSUER_URL``.

ponytail: CE-VERSION-1's real endpoint doesn't exist on ``main`` yet (a
separate lane owns it). This client is proven against a stubbed transport
(``httpx.MockTransport`` -- already a transitive dependency via ``httpx``,
no new package needed) in both unit and integration tests here; real
cross-engine wiring gets proven once that lane's endpoint merges.
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import AsyncIterator

import httpx

log = logging.getLogger(__name__)

DEFAULT_CE_BASE_URL = "http://localhost:8000"
# Brief: "tenacity retry x2, then raise" = 2 retries on top of the initial
# attempt = 3 total tries. ponytail: hand-rolled loop, not tenacity -- no
# tenacity dependency exists anywhere in this codebase; retry loops here are
# always hand-rolled (see notifications/dispatch.py's
# deliver_slack_with_retry), so this follows house style instead of adding a
# new dependency for three lines of logic.
_MAX_ATTEMPTS = 3

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


class CeVersionUnavailable(Exception):
    """CE-VERSION-1 unreachable, or returned no ``is_latest`` entry, after
    retries -- callers turn this into the 503 ``ce_version_unavailable``
    response (AC-2) and must not persist a project record.
    """


async def get_ce_client() -> AsyncIterator[httpx.AsyncClient]:
    # ponytail: same loop-rebind guard as db/pool.py's asyncpg pool and
    # auth/oidc_client.py's httpx client -- pytest-asyncio hands each test a
    # fresh event loop, so a plain module-level singleton would try to reuse
    # a dead loop's connections on the second test.
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        base_url = os.environ.get("CE_API_BASE_URL", DEFAULT_CE_BASE_URL)
        _client = httpx.AsyncClient(base_url=base_url, timeout=5.0)
        _client_loop = current_loop
    yield _client


async def close_ce_client() -> None:
    global _client, _client_loop
    if _client is not None:
        await _client.aclose()
        _client = None
        _client_loop = None


def _pick_latest(versions: list[dict[str, object]]) -> str:
    latest = next((v for v in versions if v.get("is_latest")), None)
    if latest is None:
        raise CeVersionUnavailable("CE-VERSION-1 returned no is_latest version")
    return str(latest["version_iri"])


async def get_pinned_latest_version(client: httpx.AsyncClient) -> str:
    """AC-1/AC-2: fetch ``GET /api/ontology/versions``, return the
    ``is_latest`` entry's ``version_iri``. Retries on connection error or a
    non-2xx status before giving up.
    """
    last_error: Exception | None = None
    for _attempt in range(_MAX_ATTEMPTS):
        try:
            response = await client.get("/api/ontology/versions")
            response.raise_for_status()
        except httpx.HTTPError as exc:
            last_error = exc
            log.warning("ce_version_unavailable_attempt", extra={"error": str(exc)})
            continue
        return _pick_latest(response.json())
    raise CeVersionUnavailable("CE-VERSION-1 unreachable after retries") from last_error

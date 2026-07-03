"""FastAPI dependency for the httpx client used to talk to the OIDC issuer
(mock in dev/test; real Cognito later — env var change only, see
``OIDC_ISSUER_URL``). Overridden in tests via ``app.dependency_overrides`` to
point at the in-process mock OIDC app (no real network — Law F).
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import httpx

DEFAULT_ISSUER_URL = "http://localhost:9001"


async def get_oidc_client() -> AsyncIterator[httpx.AsyncClient]:
    issuer_url = os.environ.get("OIDC_ISSUER_URL", DEFAULT_ISSUER_URL)
    async with httpx.AsyncClient(base_url=issuer_url, timeout=5.0) as client:
        yield client

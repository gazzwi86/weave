"""AC-3 + AC-2 backend contracts: refresh-token exchange for non-browser API
clients, and a protected ``/api/whoami`` proving a bearer token is really
verified (used by the auth E2E test to assert backend state, not just a UI
redirect).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from httpx import AsyncClient

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.schemas.auth import RefreshRequest, RefreshResponse

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/auth/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    client: Annotated[AsyncClient, Depends(get_oidc_client)],
) -> RefreshResponse:
    response = await client.post(
        "/token",
        data={"grant_type": "refresh_token", "refresh_token": body.refresh_token},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail={"error": "invalid_refresh_token"})

    body_json = response.json()
    return RefreshResponse(
        access_token=body_json["access_token"], expires_in=body_json["expires_in"]
    )


@router.get("/whoami", response_model=Principal)
async def whoami(principal: Annotated[Principal, Depends(get_current_principal)]) -> Principal:
    return principal

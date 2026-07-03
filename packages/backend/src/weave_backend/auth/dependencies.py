"""FastAPI dependency guarding protected routes (e.g. ``/api/whoami``).
Verifies the bearer access token and populates the tracing ContextVars
(AC-5) with the real, authenticated tenant_id/principal_iri.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request
from httpx import AsyncClient
from opentelemetry import trace
from pydantic import BaseModel

from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.auth.verify import TokenVerificationError, verify_access_token
from weave_backend.observability.context import principal_iri_var, tenant_id_var
from weave_backend.observability.tracing import add_tenant_attributes


class Principal(BaseModel):
    sub: str
    tenant_id: str
    principal_iri: str


def _bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    return auth_header.removeprefix("Bearer ")


async def get_current_principal(
    request: Request,
    client: Annotated[AsyncClient, Depends(get_oidc_client)],
) -> Principal:
    token = _bearer_token(request)
    try:
        claims = await verify_access_token(token, client)
    except TokenVerificationError as exc:
        raise HTTPException(status_code=401, detail="invalid access token") from exc

    tenant_id_var.set(claims["tenant_id"])
    principal_iri_var.set(claims["principal_iri"])
    # Re-stamp the current span (AC-5): the OTel span for this request ends
    # as soon as the response finishes streaming, which can happen before a
    # middleware's post-`call_next` code runs -- so the real, verified
    # values must be set on the span here, while it's still guaranteed open.
    add_tenant_attributes(trace.get_current_span(), {})
    return Principal(
        sub=claims["sub"], tenant_id=claims["tenant_id"], principal_iri=claims["principal_iri"]
    )

"""FastAPI dependency guarding protected routes (e.g. ``/api/whoami``).
Verifies the bearer access token, populates the tracing ContextVars (AC-5)
with the real, authenticated tenant_id/principal_iri, and rejects a
revoked session (PR #11 finding 3: this used to only be enforced on
``/workspaces/{id}/switch`` via a separate `require_active_session`
dependency -- every other route accepted a revoked member's still-live
token for up to its remaining TTL. The check now lives here so every
route depending on `get_current_principal` gets it for free.)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request
from httpx import AsyncClient
from opentelemetry import trace
from pydantic import BaseModel

from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.auth.verify import TokenTtlExceeded, TokenVerificationError, verify_access_token
from weave_backend.observability.context import principal_iri_var, tenant_id_var
from weave_backend.observability.tracing import add_tenant_attributes
from weave_backend.tenancy.sessions import get_session_version


class Principal(BaseModel):
    sub: str
    tenant_id: str
    principal_iri: str
    #: Session version embedded in the token at issue time (PLAT-TASK-003
    #: AC-3). Defaults to 0 for tokens issued before this claim existed.
    session_version: int = 0
    #: "human" or "agent" (PLAT-TASK-004 AC-2/AC-3) -- defaults to "human"
    #: for tokens issued before this claim existed.
    principal_type: str = "human"


#: AC-5 (BE-TASK-003) / AC-3 (BE-TASK-001): the platform-wide "you are not
#: authenticated" 401 contract -- distinct from the more specific
#: `token_ttl_exceeded` / `session_revoked` 401s below, which have their own
#: established, separately-tested bodies (PLAT-TASK-003/004) and are left
#: alone here.
_UNAUTHORISED_HEADERS = {"WWW-Authenticate": "Bearer"}


def _unauthorised() -> HTTPException:
    return HTTPException(
        status_code=401, detail={"error": "unauthorised"}, headers=_UNAUTHORISED_HEADERS
    )


def _bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise _unauthorised()
    return auth_header.removeprefix("Bearer ")


async def get_current_principal(
    request: Request,
    client: Annotated[AsyncClient, Depends(get_oidc_client)],
) -> Principal:
    token = _bearer_token(request)
    try:
        claims = await verify_access_token(token, client)
    except TokenTtlExceeded as exc:
        raise HTTPException(status_code=401, detail={"error": "token_ttl_exceeded"}) from exc
    except TokenVerificationError as exc:
        raise _unauthorised() from exc

    tenant_id_var.set(claims["tenant_id"])
    principal_iri_var.set(claims["principal_iri"])
    # Re-stamp the current span (AC-5): the OTel span for this request ends
    # as soon as the response finishes streaming, which can happen before a
    # middleware's post-`call_next` code runs -- so the real, verified
    # values must be set on the span here, while it's still guaranteed open.
    add_tenant_attributes(trace.get_current_span())
    principal = Principal(
        sub=claims["sub"],
        tenant_id=claims["tenant_id"],
        principal_iri=claims["principal_iri"],
        session_version=int(claims.get("session_version", "0")),
        principal_type=claims.get("principal_type", "human"),
    )

    current_session_version = await get_session_version(principal.tenant_id, principal.sub)
    if current_session_version != principal.session_version:
        raise HTTPException(status_code=401, detail={"error": "session_revoked"})
    return principal

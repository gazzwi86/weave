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

from typing import Annotated, Literal

from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from httpx import AsyncClient
from opentelemetry import trace
from pydantic import BaseModel, Field, ValidationError

from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.auth.verify import TokenTtlExceeded, TokenVerificationError, verify_access_token
from weave_backend.observability.context import principal_iri_var, tenant_id_var
from weave_backend.observability.tracing import add_tenant_attributes
from weave_backend.tenancy.sessions import get_session_version


class RoleGrant(BaseModel):
    """TASK-011 / PLAT-IDENTITY-1: one entry of the JWT `roles` claim -- a
    tenant-wide grant (`scope="tenant"`) or a domain/project-scoped grant.
    `role` is an open string (e.g. "admin"/"owner"/"editor"); this shape does
    not enumerate the vocabulary, only validates the claim's structure.

    `scope="platform"` (G15/ADR-023) is a distinct, higher tier: a platform
    operator (`role="super_admin"`), not a member of any one tenant --
    checked by `rbac.has_platform_grant`/`require_super_admin`, never by
    the tenant/domain-scope `has_admin_grant` overlay.
    """

    scope: Literal["tenant", "domain", "project", "platform"]
    role: str
    domain_iri: str | None = None
    project_iri: str | None = None


def _parse_roles_claim(raw: object) -> list[RoleGrant]:
    """Law 13: the `roles` claim is untrusted input -- shape-validate it,
    never cast. Malformed input degrades to "no grants" rather than 500ing
    the request: an authz overlay is additive-only, so losing it just falls
    through to the narrower per-resource role check, never over-grants.
    """
    if not isinstance(raw, list):
        return []
    try:
        return [RoleGrant.model_validate(item) for item in raw]
    except ValidationError:
        return []


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
    #: PLAT-IDENTITY-1 tenant/domain/project-scoped grants (TASK-011).
    #: Empty for tokens issued before this claim existed.
    roles: list[RoleGrant] = Field(default_factory=list)


class UnauthorisedError(Exception):
    """AC-5 (BE-TASK-003) / AC-3 (BE-TASK-001): raised for the platform-wide
    "you are not authenticated" case (no/garbage bearer token) -- distinct
    from the more specific `token_ttl_exceeded` / `session_revoked` 401s
    below, which have their own established, separately-tested bodies
    (PLAT-TASK-003/004) and stay on plain `HTTPException`.

    Needs its own exception + handler (registered in `weave_backend/__init__.py`)
    rather than `HTTPException(detail=...)`, because FastAPI always nests an
    `HTTPException`'s `detail` under a `"detail"` key -- there is no way to
    get a top-level `{"error": "unauthorised"}` body from it. The 422 path
    (`projects_validation_error_handler`) uses the same handler-registration
    mechanism for the same reason: only a handler returning its own
    `JSONResponse` controls the exact body shape.
    """


async def unauthorised_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """AC-5/AC-3: top-level `{"error": "unauthorised"}` body + `Www-Authenticate`."""
    del request, exc  # unused -- shape is fixed, no request-dependent detail
    return JSONResponse(
        status_code=401,
        content={"error": "unauthorised"},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise UnauthorisedError
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
        raise UnauthorisedError from exc

    principal_iri = claims.get("principal_iri")
    if not principal_iri:
        # TASK-030 AC-5 (ADR-019): a token minted without the principal_iri
        # claim must reject the request loud (401), never fall through to a
        # raw KeyError or an edit attributed to nothing.
        raise HTTPException(status_code=401, detail={"error": "missing_principal_claim"})

    tenant_id_var.set(claims["tenant_id"])
    principal_iri_var.set(principal_iri)
    # Re-stamp the current span (AC-5): the OTel span for this request ends
    # as soon as the response finishes streaming, which can happen before a
    # middleware's post-`call_next` code runs -- so the real, verified
    # values must be set on the span here, while it's still guaranteed open.
    add_tenant_attributes(trace.get_current_span())
    principal = Principal(
        sub=claims["sub"],
        tenant_id=claims["tenant_id"],
        principal_iri=principal_iri,
        session_version=int(claims.get("session_version", "0")),
        principal_type=claims.get("principal_type", "human"),
        roles=_parse_roles_claim(claims.get("roles")),
    )

    current_session_version = await get_session_version(principal.tenant_id, principal.sub)
    if current_session_version != principal.session_version:
        raise HTTPException(status_code=401, detail={"error": "session_revoked"})
    return principal

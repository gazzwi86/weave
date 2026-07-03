"""Standalone FastAPI app: a minimal OIDC provider standing in for AWS
Cognito's hosted UI in dev/test (see ``weave_backend.mock_oidc.__init__``).

Run via ``uv run weave-mock-oidc`` (port 9001 by default). Not part of the
``weave_backend`` app graph — imported directly by tests and started as its
own process by ``make dev`` / Playwright's webServer config.
"""

from __future__ import annotations

from html import escape
from typing import Any

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from weave_backend.mock_oidc.keys import JWKS
from weave_backend.mock_oidc.tokens import (
    ISSUER,
    TokenPair,
    exchange_authorization_code,
    exchange_refresh_token,
    start_authorization_code,
)

app = FastAPI(title="Weave Mock OIDC Provider")

_DEFAULT_EMAIL = "dev-user-1@weave.local"
# PLAT-TASK-003: extended from a single hardcoded tenant so cross-tenant
# tests can sign in as a second tenant's user via the `tenant_id` form field.
_DEFAULT_TENANT_ID = "acme-corp"


@app.get("/.well-known/openid-configuration")
async def openid_configuration() -> dict[str, object]:
    return {
        "issuer": ISSUER,
        "authorization_endpoint": f"{ISSUER}/authorize",
        "token_endpoint": f"{ISSUER}/token",
        "jwks_uri": f"{ISSUER}/jwks.json",
        "userinfo_endpoint": f"{ISSUER}/userinfo",
        "response_types_supported": ["code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "scopes_supported": ["openid", "email", "profile"],
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
    }


@app.get("/jwks.json")
async def jwks() -> dict[str, list[dict[str, Any]]]:
    return JWKS


@app.get("/authorize", response_class=HTMLResponse)
async def authorize(redirect_uri: str, state: str | None = None) -> str:
    """Renders a real, Playwright-drivable login form (AC-2) rather than an
    instant silent redirect — proving the redirect-and-return round trip.

    ``state`` is optional: a PKCE-only OAuth client (next-auth's default,
    with no ``redirectProxyUrl`` configured) never sends it, same as a real
    Cognito authorization request.
    """
    safe_redirect_uri = escape(redirect_uri, quote=True)
    safe_state = escape(state or "", quote=True)
    return f"""<!doctype html>
<html lang="en">
<body>
  <h1>Weave Mock OIDC — Sign in</h1>
  <form method="post" action="/login">
    <input type="hidden" name="redirect_uri" value="{safe_redirect_uri}">
    <input type="hidden" name="state" value="{safe_state}">
    <label for="email">Email</label>
    <input id="email" name="email" value="{_DEFAULT_EMAIL}">
    <label for="tenant_id">Tenant</label>
    <input id="tenant_id" name="tenant_id" value="{_DEFAULT_TENANT_ID}">
    <button type="submit">Sign in</button>
  </form>
</body>
</html>"""


@app.post("/login")
async def login(
    redirect_uri: str = Form(...),
    state: str = Form(""),
    email: str = Form(_DEFAULT_EMAIL),
    tenant_id: str = Form(_DEFAULT_TENANT_ID),
) -> RedirectResponse:
    sub = email.split("@")[0] or "dev-user"
    code = start_authorization_code(sub=sub, tenant_id=tenant_id)
    query = f"code={code}" + (f"&state={state}" if state else "")
    return RedirectResponse(f"{redirect_uri}?{query}", status_code=303)


def _token_response(pair: TokenPair) -> dict[str, object]:
    return {
        "access_token": pair.access_token,
        "id_token": pair.id_token,
        "refresh_token": pair.refresh_token,
        "expires_in": pair.expires_in,
        "token_type": "Bearer",
    }


@app.post("/token")
async def token(
    grant_type: str = Form(...),
    code: str | None = Form(None),
    refresh_token: str | None = Form(None),
) -> dict[str, object]:
    if grant_type == "authorization_code":
        pair = await exchange_authorization_code(code) if code else None
    elif grant_type == "refresh_token":
        pair = await exchange_refresh_token(refresh_token) if refresh_token else None
    else:
        raise HTTPException(status_code=400, detail={"error": "unsupported_grant_type"})

    if pair is None:
        raise HTTPException(status_code=400, detail={"error": "invalid_grant"})
    return _token_response(pair)


@app.get("/userinfo")
async def userinfo(request: Request) -> dict[str, str]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "invalid_token"})
    return {"sub": _DEFAULT_EMAIL.split("@")[0]}


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9001)  # noqa: S104 -- dev-only mock provider

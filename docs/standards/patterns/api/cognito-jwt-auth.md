---
type: Coding Standard
title: "API — AWS Cognito JWT verification dependency (python)"
description: FastAPI dependency verifying a Cognito access/ID JWT via cached JWKS (PyJWT), returning the principal; 401 on bad token, 403 on missing group.
tags: [standards, patterns, api, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/api/cognito-jwt-auth.md
topic: api
stack: python
verification: "py_compile OK; ruff check clean (unresolved app.config/jwt imports expected, not flagged)"
---

# API — AWS Cognito JWT verification dependency (python)

A FastAPI dependency that verifies a **human** caller's AWS Cognito JWT — JWKS fetched and cached
by `kid`, RS256 pinned, issuer + audience checked (correctly handling that ID tokens carry `aud`
while access tokens carry `client_id`) — and returns a typed `Principal`. Missing/invalid token
→ 401; authenticated-but-not-permitted → 403.

```python
# app/auth/cognito.py — verify a HUMAN caller's Cognito JWT
# (machines/agents authenticate via IAM role + STS, never Cognito — rbac-multi-tenancy.md)
from collections.abc import Awaitable, Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel

from app.audit import record_denial  # PLAT-AUDIT-1 authz-denied sink (rbac-multi-tenancy.md)
from app.config import settings  # region / user_pool_id / app_client_id from Secrets Manager

_ISSUER = f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.user_pool_id}"
_JWKS_URL = f"{_ISSUER}/.well-known/jwks.json"

# PyJWKClient fetches the JWKS once and caches signing keys by `kid` (refetches on rotation).
_jwks = PyJWKClient(_JWKS_URL, cache_keys=True, max_cached_keys=16)
_bearer = HTTPBearer(auto_error=False)


class Principal(BaseModel):
    """Authenticated human caller resolved from a verified Cognito JWT."""

    subject: str
    username: str
    groups: list[str]


def _verify(token: str) -> dict[str, object]:
    key = _jwks.get_signing_key_from_jwt(token)
    claims: dict[str, object] = jwt.decode(
        token,
        key.key,
        algorithms=["RS256"],  # pin RS256 — reject alg=none and HS256 key-confusion
        issuer=_ISSUER,
        options={"require": ["exp", "iss", "token_use"], "verify_aud": False},
    )
    _assert_audience(claims)
    return claims


def _assert_audience(claims: dict[str, object]) -> None:
    # Cognito ID tokens carry `aud`; ACCESS tokens carry `client_id` and no `aud`.
    token_use = claims.get("token_use")
    if token_use == "id":
        presented = claims.get("aud")
    elif token_use == "access":
        presented = claims.get("client_id")
    else:
        raise jwt.InvalidTokenError("unknown token_use")
    if presented != settings.app_client_id:
        raise jwt.InvalidAudienceError("client id mismatch")


async def current_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    if creds is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="missing_bearer_token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = _verify(creds.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return Principal(
        subject=str(claims["sub"]),
        username=str(claims.get("cognito:username", "")),
        groups=[str(g) for g in claims.get("cognito:groups", []) or []],
    )


def require_group(group: str) -> Callable[[Principal], Awaitable[Principal]]:
    """Dependency factory: 403 (audited to PLAT-AUDIT-1) if the caller lacks the group."""

    async def _dep(principal: Principal = Depends(current_principal)) -> Principal:
        if group not in principal.groups:
            # PLAT-AUDIT-1: write the authz-denied entry BEFORE raising the 403.
            await record_denial(subject=principal.subject, required_group=group)
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="forbidden")
        return principal

    return _dep
```

**Why:** `PyJWKClient` caches Cognito's rotating signing keys by `kid`, so verification is a local
crypto check with no per-request network round-trip. `verify_aud=False` + an explicit
`_assert_audience` is the only correct way to accept both token kinds — decoding an access token with
`audience=...` fails because access tokens have no `aud`.
**Security:** pinning `algorithms=["RS256"]` blocks the `alg=none` and HS256-confusion attacks (never
let the token pick its own algorithm); issuer, expiry, and audience/client-id are all asserted;
`WWW-Authenticate: Bearer` is returned on 401. Human callers only — machines use IAM/STS, so this
dependency never sees a Cognito token for a service principal. An authenticated-but-unpermitted
caller triggers a PLAT-AUDIT-1 authz-denied entry (`record_denial(...)`) that is written *before*
the 403 is raised, so every denial is forensically recorded.
**Anti-patterns:** skipping the `aud`/`client_id` split (rejects valid access tokens or accepts
foreign audiences); calling the JWKS endpoint on every request (no cache); trusting claims without
signature verification (`jwt.decode(..., options={"verify_signature": False})`); returning 403 when
the token is absent/invalid — that is 401.

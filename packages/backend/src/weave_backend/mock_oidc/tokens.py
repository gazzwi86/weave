"""In-memory authorization-code / refresh-token issuance for the mock OIDC
provider. Single dev process, single dev tenant — not a real token store.
"""

from __future__ import annotations

import os
import secrets
import time
from dataclasses import dataclass

import jwt

from weave_backend.mock_oidc.keys import KEY_ID, PRIVATE_KEY
from weave_backend.tenancy.sessions import get_session_version

ACCESS_TOKEN_TTL_SECONDS = 300  # ADR-001: real AWS Cognito minimum validity

ISSUER = os.environ.get("MOCK_OIDC_ISSUER_URL", "http://localhost:9001")
AUDIENCE = os.environ.get("OIDC_CLIENT_ID", "weave-dev")


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    id_token: str
    refresh_token: str
    expires_in: int


# code/refresh_token -> claims. ponytail: process-lifetime dict is fine for a
# dev-only mock; a real IdP persists these, this one restarts with the process.
_AUTH_CODES: dict[str, dict[str, str]] = {}
_REFRESH_TOKENS: dict[str, dict[str, str]] = {}


def _claims(sub: str, tenant_id: str) -> dict[str, str]:
    return {"sub": sub, "tenant_id": tenant_id, "principal_iri": f"urn:weave:principal:{sub}"}


def _sign(claims: dict[str, str], ttl: int) -> str:
    now = int(time.time())
    # jti: same-second reissues (e.g. immediate refresh) would otherwise
    # produce byte-identical JWTs since iat/exp/claims are all unchanged.
    payload = {
        **claims,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + ttl,
        "jti": secrets.token_urlsafe(8),
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256", headers={"kid": KEY_ID})


async def issue_token_pair(*, sub: str, tenant_id: str) -> TokenPair:
    """Issue a fresh access/id/refresh token set for `sub`, rooting a new
    refresh-token entry so a later refresh-grant can reissue for the same
    claims. The signed tokens additionally carry `session_version` (read
    from the same Redis a real revoke bumps) -- kept out of `_claims()` so
    the exact-equality `test_claims_shape` pin still holds; this is
    runtime-only, added at sign time.
    """
    claims = _claims(sub, tenant_id)
    refresh_token = secrets.token_urlsafe(32)
    _REFRESH_TOKENS[refresh_token] = claims
    session_version = await get_session_version(tenant_id, sub)
    signed_claims = {**claims, "session_version": str(session_version)}
    return TokenPair(
        access_token=_sign(signed_claims, ACCESS_TOKEN_TTL_SECONDS),
        id_token=_sign(signed_claims, ACCESS_TOKEN_TTL_SECONDS),
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_TTL_SECONDS,
    )


def start_authorization_code(*, sub: str, tenant_id: str) -> str:
    code = secrets.token_urlsafe(16)
    _AUTH_CODES[code] = _claims(sub, tenant_id)
    return code


async def exchange_authorization_code(code: str) -> TokenPair | None:
    claims = _AUTH_CODES.pop(code, None)
    if claims is None:
        return None
    return await issue_token_pair(sub=claims["sub"], tenant_id=claims["tenant_id"])


async def exchange_refresh_token(refresh_token: str) -> TokenPair | None:
    claims = _REFRESH_TOKENS.get(refresh_token)
    if claims is None:
        return None
    return await issue_token_pair(sub=claims["sub"], tenant_id=claims["tenant_id"])

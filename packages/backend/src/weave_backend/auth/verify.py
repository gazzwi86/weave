"""Verifies an access token's RS256 signature against the OIDC issuer's JWKS.
Signature + expiry only — issuer/audience checks are skipped deliberately
(ponytail: single-tenant dev mock issuer, tighten if a second issuer is ever
trusted in the same deployment).

PLAT-TASK-004 additions: a per-token-type TTL ceiling (AC-5, ADR-001) and a
short JWKS cache (cross-task ledger fix) -- the mock issuer's key never
rotates mid-process, so refetching `/jwks.json` on every single request is
pure overhead.
"""

from __future__ import annotations

import time
from typing import cast

import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from httpx import AsyncClient
from jwt.algorithms import RSAAlgorithm

#: AC-5 (brief adjustment supersedes the original "TTL > 60s rejected" for
#: every token): human tokens inherit AWS Cognito's real 300s minimum
#: access-token validity (ADR-001); agent tokens are our own mint, no such
#: floor.
TOKEN_TTL_CEILING_SECONDS = {"human": 300, "agent": 60}

_JWKS_CACHE_TTL_SECONDS = 300
_jwk_cache: dict[str, tuple[dict[str, str], float]] = {}


class TokenVerificationError(Exception):
    """Raised for any invalid, expired, or unverifiable access token."""


class TokenTtlExceeded(TokenVerificationError):
    """Raised when a token's `exp - iat` exceeds its type's TTL ceiling."""


def enforce_token_ttl_ceiling(claims: dict[str, object]) -> None:
    """Tokens minted before `principal_type` existed (PLAT-TASK-003) default
    to the human ceiling -- never the shorter agent one.
    """
    principal_type = str(claims.get("principal_type", "human"))
    ceiling = TOKEN_TTL_CEILING_SECONDS.get(principal_type, TOKEN_TTL_CEILING_SECONDS["human"])
    lifetime = int(claims["exp"]) - int(claims["iat"])  # type: ignore[call-overload]
    if lifetime > ceiling:
        raise TokenTtlExceeded(
            f"token lifetime {lifetime}s exceeds {principal_type} ceiling {ceiling}s"
        )


async def _fetch_jwk_for_kid(client: AsyncClient, kid: str) -> dict[str, str]:
    cached = _jwk_cache.get(kid)
    if cached is not None and cached[1] > time.monotonic():
        return cached[0]

    response = await client.get("/jwks.json")
    response.raise_for_status()
    keys = response.json()["keys"]
    for key in keys:
        if key.get("kid") == kid:
            _jwk_cache[kid] = (key, time.monotonic() + _JWKS_CACHE_TTL_SECONDS)
            return cast(dict[str, str], key)
    raise TokenVerificationError(f"no signing key found for kid={kid!r}")


async def verify_access_token(token: str, client: AsyncClient) -> dict[str, str]:
    try:
        header = jwt.get_unverified_header(token)
        jwk = await _fetch_jwk_for_kid(client, header["kid"])
        public_key = cast(RSAPublicKey, RSAAlgorithm.from_jwk(jwk))
        claims: dict[str, str] = jwt.decode(
            token, public_key, algorithms=["RS256"], options={"verify_aud": False}
        )
    except (jwt.PyJWTError, KeyError, TokenVerificationError) as exc:
        raise TokenVerificationError(str(exc)) from exc
    # Outside the try above: TokenTtlExceeded must propagate as itself, not
    # get folded into a plain TokenVerificationError -- callers distinguish
    # the 401 `token_ttl_exceeded` body from a generic invalid-token 401.
    enforce_token_ttl_ceiling(claims)  # type: ignore[arg-type]
    return claims

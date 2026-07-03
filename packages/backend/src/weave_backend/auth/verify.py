"""Verifies an access token's RS256 signature against the OIDC issuer's JWKS.
Signature + expiry only — issuer/audience checks are skipped deliberately
(ponytail: single-tenant dev mock issuer, tighten if a second issuer is ever
trusted in the same deployment).
"""

from __future__ import annotations

from typing import cast

import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from httpx import AsyncClient
from jwt.algorithms import RSAAlgorithm


class TokenVerificationError(Exception):
    """Raised for any invalid, expired, or unverifiable access token."""


async def _fetch_jwk_for_kid(client: AsyncClient, kid: str) -> dict[str, str]:
    response = await client.get("/jwks.json")
    response.raise_for_status()
    keys = response.json()["keys"]
    for key in keys:
        if key.get("kid") == kid:
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
    return claims

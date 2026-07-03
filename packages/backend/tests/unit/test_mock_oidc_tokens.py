"""Direct unit coverage for the mock OIDC token-issuance internals — the
HTTP-level tests in ``test_mock_oidc.py`` exercise the grant flows end to end
but don't pin exact claim shapes, so mutations to key names/defaults here
were slipping through as passing (still-green) HTTP tests.
"""

from __future__ import annotations

from typing import cast

import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey

from weave_backend.mock_oidc.keys import JWKS, KEY_ID
from weave_backend.mock_oidc.tokens import (
    AUDIENCE,
    ISSUER,
    _claims,
    _sign,
    exchange_refresh_token,
    issue_token_pair,
    start_authorization_code,
)

_PUBLIC_KEY = cast(RSAPublicKey, jwt.algorithms.RSAAlgorithm.from_jwk(JWKS["keys"][0]))


def _decode(token: str) -> dict[str, object]:
    return jwt.decode(
        token, _PUBLIC_KEY, algorithms=["RS256"], options={"verify_aud": False}
    )


def test_claims_shape() -> None:
    assert _claims("u1", "tenant1") == {
        "sub": "u1",
        "tenant_id": "tenant1",
        "principal_iri": "urn:weave:principal:u1",
    }


def test_sign_produces_a_jwt_with_expected_registered_claims() -> None:
    token = _sign({"sub": "u1"}, 300)

    header = jwt.get_unverified_header(token)
    claims = _decode(token)

    assert header["kid"] == KEY_ID
    assert claims["iss"] == ISSUER
    assert claims["aud"] == AUDIENCE
    assert claims["exp"] == cast(int, claims["iat"]) + 300
    assert len(cast(str, claims["jti"])) == 11  # secrets.token_urlsafe(8)


def test_sign_gives_each_call_a_distinct_jti() -> None:
    first = _decode(_sign({"sub": "u1"}, 300))
    second = _decode(_sign({"sub": "u1"}, 300))

    assert first["jti"] != second["jti"]


async def test_issue_token_pair_fields() -> None:
    pair = await issue_token_pair(sub="u1", tenant_id="tenant1")

    assert len(pair.refresh_token) == 43  # secrets.token_urlsafe(32)
    assert pair.expires_in == 300
    assert _decode(pair.id_token)["tenant_id"] == "tenant1"
    assert _decode(pair.access_token)["sub"] == "u1"


async def test_issue_token_pair_embeds_session_version() -> None:
    """PLAT-TASK-003 AC-3: a freshly issued token carries the current
    session version (0 when Redis is unreachable/unset), separate from the
    pinned `_claims()` shape above.
    """
    pair = await issue_token_pair(sub="u-session", tenant_id="tenant1")

    assert _decode(pair.access_token)["session_version"] == "0"


def test_start_authorization_code_length() -> None:
    code = start_authorization_code(sub="u1", tenant_id="tenant1")

    assert len(code) == 22  # secrets.token_urlsafe(16)


async def test_exchange_refresh_token_reissues_for_the_same_claims() -> None:
    original = await issue_token_pair(sub="dave", tenant_id="acme")

    reissued = await exchange_refresh_token(original.refresh_token)

    assert reissued is not None
    claims = _decode(reissued.access_token)
    assert claims["sub"] == "dave"
    assert claims["tenant_id"] == "acme"

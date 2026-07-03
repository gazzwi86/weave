"""Ephemeral RSA signing key for the mock OIDC provider.

Generated once per process — a real Cognito pool manages its own key
rotation; this mock only needs *a* stable key for the lifetime of one dev/
test run.
"""

from __future__ import annotations

from typing import Any

from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

_KEY_ID = "mock-oidc-1"

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_jwk = RSAAlgorithm.to_jwk(_private_key.public_key(), as_dict=True)
_public_jwk["kid"] = _KEY_ID
_public_jwk["use"] = "sig"
_public_jwk["alg"] = "RS256"

KEY_ID = _KEY_ID
PRIVATE_KEY = _private_key
# JWK fields are a str/list[str] mix (e.g. key_ops) -- Any is honest here.
JWKS: dict[str, list[dict[str, Any]]] = {"keys": [_public_jwk]}

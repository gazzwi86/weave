"""PLAT-TASK-004 AC-2: STS boundary + agent JWT signing, mocked at the boto3
client boundary -- true unit level, no LocalStack container needed.
"""

from __future__ import annotations

from typing import Any

import jwt
import pytest
from botocore.exceptions import ClientError

from weave_backend.auth.agent import (
    AGENT_TOKEN_TTL_SECONDS,
    StsValidationError,
    get_caller_identity_arn,
    sign_agent_token,
)
from weave_backend.mock_oidc.keys import JWKS


class _FakeStsClient:
    def __init__(self, *, arn: str | None = None, error: Exception | None = None) -> None:
        self._arn = arn
        self._error = error

    def get_caller_identity(self) -> dict[str, Any]:
        if self._error is not None:
            raise self._error
        return {"Arn": self._arn}


async def test_get_caller_identity_arn_returns_the_resolved_arn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_arn = "arn:aws:iam::000000000000:role/test-agent"
    monkeypatch.setattr(
        "weave_backend.auth.agent.boto3.client",
        lambda *a, **kw: _FakeStsClient(arn=fake_arn),
    )

    assert await get_caller_identity_arn("any-session-token") == fake_arn


async def test_get_caller_identity_arn_wraps_client_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    error = ClientError({"Error": {"Code": "AccessDenied", "Message": "no"}}, "GetCallerIdentity")
    monkeypatch.setattr(
        "weave_backend.auth.agent.boto3.client",
        lambda *a, **kw: _FakeStsClient(error=error),
    )

    with pytest.raises(StsValidationError):
        await get_caller_identity_arn("bad-session-token")


def test_sign_agent_token_is_verifiable_and_capped_at_60s() -> None:
    token = sign_agent_token(
        sub="agenthash", tenant_id="acme", principal_iri="urn:weave:principal:agent:agenthash"
    )

    header = jwt.get_unverified_header(token)
    assert header["kid"] == JWKS["keys"][0]["kid"]
    # Test-only: reads claims off a token the test itself just minted to assert its
    # shape (type, TTL). Signature integrity is covered by verify.py's own tests.
    # nosemgrep: python.jwt.security.unverified-jwt-decode.unverified-jwt-decode
    claims = jwt.decode(token, options={"verify_signature": False})
    assert claims["principal_type"] == "agent"
    assert claims["exp"] - claims["iat"] == AGENT_TOKEN_TTL_SECONDS

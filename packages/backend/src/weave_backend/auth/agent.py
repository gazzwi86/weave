"""AC-2: agent identity via AWS STS (never Cognito -- agents aren't humans,
so there's no OIDC login screen for them). `validate_sts_token` is the one
boundary that talks to LocalStack (Law F: never real AWS); a route-level test
overrides it directly to exercise the 401 path, since LocalStack's community
edition accepts any session token unconditionally (verified empirically --
there is no input that makes it reject a `GetCallerIdentity` call).

Agent JWTs reuse the mock OIDC provider's signing key so the existing
JWKS-based verifier (`auth.verify.verify_access_token`) checks an agent token
identically to a human one -- one verification path for both principal
types, per this task's design decision.
"""

from __future__ import annotations

import os
import secrets
import time

import boto3
import jwt
from botocore.exceptions import BotoCoreError, ClientError

from weave_backend.mock_oidc.keys import KEY_ID, PRIVATE_KEY
from weave_backend.mock_oidc.tokens import AUDIENCE, ISSUER

#: ADR-001 only sets a floor for *human* tokens (AWS Cognito's real minimum
#: access-token validity). Agent tokens are our own mint -- no such floor.
AGENT_TOKEN_TTL_SECONDS = 60


class StsValidationError(Exception):
    """Raised when `GetCallerIdentity` fails to resolve a caller ARN."""


def get_caller_identity_arn(sts_token: str) -> str:
    """Resolves the IAM role ARN behind an STS session token."""
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", "http://localhost:4566")
    client = boto3.client(
        "sts",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",  # noqa: S106 -- LocalStack's well-known dummy creds
        aws_session_token=sts_token,
    )
    try:
        identity = client.get_caller_identity()
    except (BotoCoreError, ClientError) as exc:
        raise StsValidationError(str(exc)) from exc
    return str(identity["Arn"])


def sign_agent_token(*, sub: str, tenant_id: str, principal_iri: str) -> str:
    now = int(time.time())
    payload = {
        "sub": sub,
        "tenant_id": tenant_id,
        "principal_iri": principal_iri,
        "principal_type": "agent",
        "session_version": "0",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + AGENT_TOKEN_TTL_SECONDS,
        "jti": secrets.token_urlsafe(8),
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256", headers={"kid": KEY_ID})

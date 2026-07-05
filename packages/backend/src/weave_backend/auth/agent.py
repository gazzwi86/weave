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

import asyncio
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


def _get_caller_identity_arn_sync(sts_token: str) -> str:
    default_endpoint = f"http://localhost:{os.environ.get('WEAVE_LOCALSTACK_PORT', '4566')}"
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", default_endpoint)
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


async def get_caller_identity_arn(sts_token: str) -> str:
    """Resolves the IAM role ARN behind an STS session token. Runs the
    synchronous boto3 call off the event loop via `asyncio.to_thread` --
    agents remint ~every 60s, and a blocking STS round trip here would
    stall every in-flight request process-wide (single-threaded asyncio
    loop). A single cached module-level client (the httpx/asyncpg pattern)
    isn't viable here: the session token being resolved IS the client's
    credential, so each call still needs its own client bound to it -- only
    the network call itself moves off-loop.
    """
    return await asyncio.to_thread(_get_caller_identity_arn_sync, sts_token)


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

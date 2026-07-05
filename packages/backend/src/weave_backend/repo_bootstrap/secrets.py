"""BE-TASK-010 (build-engine EPIC-011) AC-5: the provider auth token is read
from AWS Secrets Manager only, never hardcoded/logged. Mirrors the
boto3/LocalStack client construction already used by
`audit/signing_key.py`, `auth/agent.py` (STS), and `storage/tenant_objects.py`
(S3) -- duplicated rather than imported from `audit/signing_key.py` since
that helper is private (`_`-prefixed) and this is Build-engine code, not
Platform/audit code; a ~10-line duplicate is cheaper than a cross-engine
import for this.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any, cast

import boto3
from botocore.exceptions import ClientError

#: boto3 has no first-party type stubs -- `Any` here, not a cast on
#: untrusted input (Law 13 concerns request bodies, not an internal client
#: handle).
SecretsClient = Any


def _secrets_client() -> SecretsClient:
    default_endpoint = f"http://localhost:{os.environ.get('WEAVE_LOCALSTACK_PORT', '4566')}"
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", default_endpoint)
    return boto3.client(
        "secretsmanager",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",  # noqa: S106 -- LocalStack's well-known dummy creds
    )


def _fetch_sync(secret_id: str) -> str | None:
    client = _secrets_client()
    try:
        response = client.get_secret_value(SecretId=secret_id)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ResourceNotFoundException":
            return None
        raise
    # boto3 has no stubs -- `response` is `Any`; the cast documents the known
    # shape of a `get_secret_value` response, not a cast on untrusted input.
    return cast("str | None", response.get("SecretString"))


async def get_scm_token(secret_id: str) -> str | None:
    """Fetches the source-control provider token by its Secrets Manager
    reference (`projects.source_control_token_secret_ref`). Returns `None`
    if no such secret exists -- the caller (AC-4) turns that into the
    fail-closed `repo_auth_invalid` error, never a Weave-internal fallback.
    """
    return await asyncio.to_thread(_fetch_sync, secret_id)

"""PLAT-AUDIT-1 signing key custody: an ed25519 keypair generated once at
first boot and persisted in Secrets Manager (LocalStack only -- Law F, no
live AWS) at `weave/platform/audit-signing-key`. Never written to disk,
env vars, or logs. Mirrors the boto3/LocalStack client construction already
used by `auth/agent.py` (STS) and `storage/tenant_objects.py` (S3).
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import boto3
from botocore.exceptions import ClientError
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

#: boto3 has no first-party type stubs (`boto3-stubs` extra this task
#: doesn't otherwise need) -- `Any` here, not a cast on untrusted input (Law
#: 13 concerns request bodies, not an internal client handle).
SecretsClient = Any

SECRET_ID = "weave/platform/audit-signing-key"  # noqa: S105 -- a Secrets Manager path, not a secret

_cached_key: Ed25519PrivateKey | None = None


def _secrets_client() -> SecretsClient:
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", "http://localhost:4566")
    return boto3.client(
        "secretsmanager",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",  # noqa: S106 -- LocalStack's well-known dummy creds
    )


def _fetch_or_create_key_bytes_sync() -> bytes:
    client = _secrets_client()
    try:
        response = client.get_secret_value(SecretId=SECRET_ID)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
            raise
        private_key = Ed25519PrivateKey.generate()
        raw = private_key.private_bytes_raw()
        client.create_secret(Name=SECRET_ID, SecretString=raw.hex())
        return raw
    return bytes.fromhex(response["SecretString"])


async def get_signing_key() -> Ed25519PrivateKey:
    """Returns the process-wide ed25519 private key, generating and
    persisting one on first call if none exists yet. Cached per-process
    after the first fetch -- the key never changes within a running process,
    and re-fetching on every `emit()` would add a LocalStack round trip to
    every audited mutation.
    """
    global _cached_key
    if _cached_key is None:
        raw = await asyncio.to_thread(_fetch_or_create_key_bytes_sync)
        _cached_key = Ed25519PrivateKey.from_private_bytes(raw)
    return _cached_key


def reset_cached_key_for_tests() -> None:
    """Test-only escape hatch -- integration tests that need a fresh
    Secrets Manager round trip (e.g. asserting key persistence across
    "restarts") must clear the process-level cache first.
    """
    global _cached_key
    _cached_key = None

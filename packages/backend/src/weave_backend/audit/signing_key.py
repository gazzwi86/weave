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

_cached_key: Ed25519PrivateKey | None = None  # gitleaks:allow -- type name, not a secret


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


def _create_and_persist_key_sync(client: SecretsClient) -> bytes:
    private_key = Ed25519PrivateKey.generate()
    raw = private_key.private_bytes_raw()
    try:
        client.create_secret(Name=SECRET_ID, SecretString=raw.hex())
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ResourceExistsException":
            raise
        # Lost the race to another cold instance -- never trust our own
        # locally-generated key, it was never persisted and can never
        # verify entries signed with it later. Re-fetch the winner's key.
        response = client.get_secret_value(SecretId=SECRET_ID)
        return bytes.fromhex(response["SecretString"])
    return raw


def _fetch_or_create_key_bytes_sync() -> bytes:
    client = _secrets_client()
    try:
        response = client.get_secret_value(SecretId=SECRET_ID)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
            raise
        return _create_and_persist_key_sync(client)
    return bytes.fromhex(response["SecretString"])


#: Closes the cheap, in-process half of the bootstrap race (two concurrent
#: cold `get_signing_key()` calls in the same process). The cross-instance
#: race is closed by `_create_and_persist_key_sync`'s re-fetch-on-conflict.
_cache_lock: asyncio.Lock | None = None
_cache_lock_loop: asyncio.AbstractEventLoop | None = None


def _get_cache_lock() -> asyncio.Lock:
    # ponytail: asyncio.Lock() binds to whatever event loop is running the
    # first time it's awaited (same bug class fixed for get_redis in
    # tenancy/sessions.py and the asyncpg pool in db/pool.py) -- recreate
    # whenever the running loop has changed instead of caching forever.
    global _cache_lock, _cache_lock_loop
    current_loop = asyncio.get_event_loop()
    if _cache_lock is None or _cache_lock_loop is not current_loop:
        _cache_lock = asyncio.Lock()
        _cache_lock_loop = current_loop
    return _cache_lock


async def get_signing_key() -> Ed25519PrivateKey:
    """Returns the process-wide ed25519 private key, generating and
    persisting one on first call if none exists yet. Cached per-process
    after the first fetch -- the key never changes within a running process,
    and re-fetching on every `emit()` would add a LocalStack round trip to
    every audited mutation.
    """
    global _cached_key
    if _cached_key is not None:
        return _cached_key
    async with _get_cache_lock():
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

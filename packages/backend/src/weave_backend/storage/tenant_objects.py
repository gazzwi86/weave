"""AC-6 deviation: S3 Vectors has no local emulator, so LocalStack S3 with a
mandatory `tenant/{tenant_id}/` key prefix stands in for it here. Isolation
is enforced at the application layer (every call is prefix-scoped; nothing
ever lists or reads without a tenant prefix) rather than by an IAM bucket
policy, since there's no real AWS account to attach one to locally (Law F).
The real S3 Vectors integration re-points this module's bucket/client only.
"""

from __future__ import annotations

import os
from typing import Any

import boto3

#: boto3 has no first-party type stubs and `boto3-stubs` is an extra
#: dependency this task doesn't otherwise need -- `Any` here, not a cast on
#: untrusted input (Law 13 concerns request bodies, not an internal client
#: handle).
S3Client = Any


def s3_client() -> S3Client:
    default_endpoint = f"http://localhost:{os.environ.get('WEAVE_LOCALSTACK_PORT', '4566')}"
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", default_endpoint)
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",  # noqa: S106 -- LocalStack's well-known dummy creds, not a real secret
    )


def tenant_prefix(tenant_id: str) -> str:
    return f"tenant/{tenant_id}/"


def object_key(tenant_id: str, workspace_id: str, name: str) -> str:
    return f"{tenant_prefix(tenant_id)}{workspace_id}/{name}"


def put_object(client: S3Client, bucket: str, key: str, body: bytes) -> None:
    client.put_object(Bucket=bucket, Key=key, Body=body)


def list_tenant_object_keys(client: S3Client, bucket: str, tenant_id: str) -> list[str]:
    """Always scoped by `Prefix` -- the only way this module ever lists
    objects. A caller can never broaden this to a bucket-wide listing.
    """
    response = client.list_objects_v2(Bucket=bucket, Prefix=tenant_prefix(tenant_id))
    return [item["Key"] for item in response.get("Contents", [])]

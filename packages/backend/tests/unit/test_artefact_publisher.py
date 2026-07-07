"""BE-TASK-009 unit tests: `artefact_publisher.publish` -- wraps a single S3
put (`storage/tenant_objects.py`'s existing `s3_client`/`put_object`), Law
F: a fake S3 client double stands in, never a real boto3/LocalStack call in
a unit test (LocalStack proof lives in `tests/integration/test_deploy_api.py`).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from weave_backend.deploy.artefact_publisher import PublishError, publish

_MODULE = "weave_backend.deploy.artefact_publisher"


class _FakeS3Client:
    def __init__(self, *, existing_buckets: list[str] | None = None, fail: bool = False) -> None:
        self.fail = fail
        self.buckets = list(existing_buckets or [])
        self.put_calls: list[tuple[str, str, bytes]] = []

    def list_buckets(self) -> dict[str, Any]:
        return {"Buckets": [{"Name": name} for name in self.buckets]}

    def create_bucket(self, Bucket: str) -> None:
        self.buckets.append(Bucket)

    def put_object(self, Bucket: str, Key: str, Body: bytes) -> None:
        if self.fail:
            raise RuntimeError("S3 put_object failed")
        self.put_calls.append((Bucket, Key, Body))


async def test_publish_returns_s3_uri_on_success() -> None:
    fake_client = _FakeS3Client()
    with patch(f"{_MODULE}.s3_client", return_value=fake_client):
        result = await publish("sha-123", "t1", "run-1")

    assert result == "s3://weave-artefacts/t1/run-1/"
    assert len(fake_client.put_calls) == 1


async def test_publish_raises_publish_error_on_any_failure() -> None:
    fake_client = _FakeS3Client(fail=True)
    with (
        patch(f"{_MODULE}.s3_client", return_value=fake_client),
        pytest.raises(PublishError),
    ):
        await publish("sha-123", "t1", "run-1")

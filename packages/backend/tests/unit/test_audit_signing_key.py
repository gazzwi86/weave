"""Signing-key custody, mocked at the boto3 client boundary (no LocalStack
container needed) -- matching `test_auth_agent.py`'s STS-mocking precedent.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from botocore.exceptions import ClientError

from weave_backend.audit.signing_key import get_signing_key, reset_cached_key_for_tests


class _FakeSecretsClient:
    def __init__(self, *, existing_hex: str | None = None) -> None:
        self.existing_hex = existing_hex
        self.created: dict[str, str] = {}

    def get_secret_value(self, *, SecretId: str) -> dict[str, Any]:
        if self.existing_hex is None:
            raise ClientError(
                {"Error": {"Code": "ResourceNotFoundException", "Message": "no such secret"}},
                "GetSecretValue",
            )
        return {"SecretString": self.existing_hex}

    def create_secret(self, *, Name: str, SecretString: str) -> None:
        self.created[Name] = SecretString


@pytest.fixture(autouse=True)
def _reset_cache() -> Iterator[None]:
    reset_cached_key_for_tests()
    yield
    reset_cached_key_for_tests()


async def test_get_signing_key_creates_and_persists_new_key_when_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = _FakeSecretsClient(existing_hex=None)
    monkeypatch.setattr(
        "weave_backend.audit.signing_key.boto3.client", lambda *a, **kw: fake_client
    )

    key = await get_signing_key()

    assert key.private_bytes_raw().hex() in fake_client.created.values()


async def test_get_signing_key_fetches_existing_key_from_secrets_manager(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    existing = "11" * 32
    fake_client = _FakeSecretsClient(existing_hex=existing)
    monkeypatch.setattr(
        "weave_backend.audit.signing_key.boto3.client", lambda *a, **kw: fake_client
    )

    key = await get_signing_key()

    assert key.private_bytes_raw().hex() == existing


async def test_get_signing_key_caches_across_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    class _CountingClient(_FakeSecretsClient):
        def get_secret_value(self, *, SecretId: str) -> dict[str, Any]:
            nonlocal calls
            calls += 1
            return super().get_secret_value(SecretId=SecretId)

    monkeypatch.setattr(
        "weave_backend.audit.signing_key.boto3.client",
        lambda *a, **kw: _CountingClient(existing_hex="22" * 32),
    )

    first = await get_signing_key()
    second = await get_signing_key()

    assert first is second
    assert calls == 1


async def test_get_signing_key_reraises_unexpected_client_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _BrokenClient(_FakeSecretsClient):
        def get_secret_value(self, *, SecretId: str) -> dict[str, Any]:
            raise ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "no"}}, "GetSecretValue"
            )

    monkeypatch.setattr(
        "weave_backend.audit.signing_key.boto3.client", lambda *a, **kw: _BrokenClient()
    )

    with pytest.raises(ClientError):
        await get_signing_key()

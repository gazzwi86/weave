"""BE-TASK-010 (build-engine EPIC-011) AC-5: provider auth token read from
AWS Secrets Manager only. Mocked at the boto3 client boundary -- same
precedent as `test_audit_signing_key.py` (no LocalStack container needed
for this unit-level test).
"""

from __future__ import annotations

from typing import Any

import pytest
from botocore.exceptions import ClientError

from weave_backend.repo_bootstrap.secrets import get_scm_token


class _FakeSecretsClient:
    def __init__(self, *, secret_string: str | None) -> None:
        self._secret_string = secret_string

    def get_secret_value(self, *, SecretId: str) -> dict[str, Any]:
        if self._secret_string is None:
            raise ClientError(
                {"Error": {"Code": "ResourceNotFoundException", "Message": "no such secret"}},
                "GetSecretValue",
            )
        return {"SecretString": self._secret_string}


async def test_get_scm_token_returns_secret_string_when_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client",
        lambda *a, **kw: _FakeSecretsClient(secret_string="ghp_abc123"),
    )

    token = await get_scm_token("weave/tenant/scm-project/github-token")

    assert token == "ghp_abc123"


async def test_get_scm_token_returns_none_when_secret_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client",
        lambda *a, **kw: _FakeSecretsClient(secret_string=None),
    )

    token = await get_scm_token("weave/tenant/scm-project/missing-token")

    assert token is None


async def test_get_scm_token_reraises_unexpected_client_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _BrokenClient(_FakeSecretsClient):
        def get_secret_value(self, *, SecretId: str) -> dict[str, Any]:
            error = {"Error": {"Code": "AccessDenied", "Message": "no"}}
            raise ClientError(error, "GetSecretValue")

    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client",
        lambda *a, **kw: _BrokenClient(secret_string=None),
    )

    with pytest.raises(ClientError):
        await get_scm_token("weave/tenant/scm-project/github-token")

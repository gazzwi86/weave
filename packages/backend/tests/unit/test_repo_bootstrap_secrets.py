"""BE-TASK-010 (build-engine EPIC-011) AC-5: provider auth token read from
AWS Secrets Manager only. Mocked at the boto3 client boundary -- same
precedent as `test_audit_signing_key.py` (no LocalStack container needed
for this unit-level test).

TASK-023 (E2-S6, FR-061/B9) AC-1/AC-2 adds the write side: `put_scm_token`
(create-or-replace) and `build_scm_secret_ref` (project-scoped naming).
"""

from __future__ import annotations

from typing import Any

import pytest
from botocore.exceptions import ClientError

from weave_backend.repo_bootstrap.secrets import (
    build_scm_secret_ref,
    describe_secret,
    get_scm_token,
    put_scm_token,
)


class _FakeSecretsClient:
    def __init__(
        self,
        *,
        secret_string: str | None,
        exists_on_create: bool = False,
        describe_calls: list[str] | None = None,
    ) -> None:
        self._secret_string = secret_string
        self._exists_on_create = exists_on_create
        self.created: dict[str, str] = {}
        self.put_calls: list[tuple[str, str]] = []
        self.describe_calls = describe_calls if describe_calls is not None else []

    def get_secret_value(self, *, SecretId: str) -> dict[str, Any]:
        if self._secret_string is None:
            raise ClientError(
                {"Error": {"Code": "ResourceNotFoundException", "Message": "no such secret"}},
                "GetSecretValue",
            )
        return {"SecretString": self._secret_string}

    def describe_secret(self, *, SecretId: str) -> dict[str, Any]:
        self.describe_calls.append(SecretId)
        if self._secret_string is None:
            raise ClientError(
                {"Error": {"Code": "ResourceNotFoundException", "Message": "no such secret"}},
                "DescribeSecret",
            )
        return {"Name": SecretId}

    def create_secret(self, *, Name: str, SecretString: str) -> dict[str, Any]:
        if self._exists_on_create:
            raise ClientError(
                {"Error": {"Code": "ResourceExistsException", "Message": "already exists"}},
                "CreateSecret",
            )
        self.created[Name] = SecretString
        return {"Name": Name}

    def put_secret_value(self, *, SecretId: str, SecretString: str) -> dict[str, Any]:
        self.put_calls.append((SecretId, SecretString))
        return {"Name": SecretId}


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


# TASK-023 AC-2: reference naming -- project-scoped (a bare tenant+provider
# key collides across two projects in the same tenant using the same
# provider), built from the existing `weave/.../scm/.../token` convention
# (test_repo_bootstrap.py's `_seed_scm_token`), extended with the project
# slug extracted from the project IRI (`urn:weave:project:{tenant}:{slug}`).
# See ADR-002 in docs/specs/weave/engines/build-engine/decisions/.
def test_build_scm_secret_ref_is_project_scoped() -> None:
    ref = build_scm_secret_ref(
        tenant_id="acme",
        project_iri="urn:weave:project:acme:widgets",
        provider="github",
    )

    assert ref == "weave/acme/scm/widgets/github/token"


def test_build_scm_secret_ref_differs_per_project_same_provider() -> None:
    ref_a = build_scm_secret_ref(
        tenant_id="acme", project_iri="urn:weave:project:acme:widgets", provider="github"
    )
    ref_b = build_scm_secret_ref(
        tenant_id="acme", project_iri="urn:weave:project:acme:gadgets", provider="github"
    )

    assert ref_a != ref_b


async def test_put_scm_token_creates_secret_when_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeSecretsClient(secret_string=None)
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client", lambda *a, **kw: fake
    )

    await put_scm_token("weave/acme/scm/widgets/github/token", "ghp_new")

    assert fake.created["weave/acme/scm/widgets/github/token"] == "ghp_new"


async def test_put_scm_token_replaces_secret_when_already_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeSecretsClient(secret_string="ghp_old", exists_on_create=True)
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client", lambda *a, **kw: fake
    )

    await put_scm_token("weave/acme/scm/widgets/github/token", "ghp_replacement")

    assert fake.put_calls == [("weave/acme/scm/widgets/github/token", "ghp_replacement")]


async def test_put_scm_token_reraises_unexpected_client_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _BrokenClient(_FakeSecretsClient):
        def create_secret(self, *, Name: str, SecretString: str) -> dict[str, Any]:
            error = {"Error": {"Code": "AccessDenied", "Message": "no"}}
            raise ClientError(error, "CreateSecret")

    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client",
        lambda *a, **kw: _BrokenClient(secret_string=None),
    )

    with pytest.raises(ClientError):
        await put_scm_token("weave/acme/scm/widgets/github/token", "ghp_x")


# --- TASK-006 AC-3: describe_secret -- existence only, never get_secret_value ---


async def test_describe_secret_returns_true_when_secret_exists(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeSecretsClient(secret_string="ghp_abc123")
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client", lambda *a, **kw: fake
    )

    ok = await describe_secret("weave/tenant/scm-project/github-token")

    assert ok is True


async def test_describe_secret_returns_false_when_secret_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeSecretsClient(secret_string=None)
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client", lambda *a, **kw: fake
    )

    ok = await describe_secret("weave/tenant/scm-project/missing-token")

    assert ok is False


async def test_describe_secret_never_calls_get_secret_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-3: a spy on the secrets client proves `describe_secret` reaches
    only `describe_secret` on the boto3 client, never `get_secret_value` --
    a real value must never even be requested, let alone exposed.
    """

    class _ExplodingOnValueClient(_FakeSecretsClient):
        def get_secret_value(self, *, SecretId: str) -> dict[str, Any]:
            raise AssertionError("get_secret_value must never be called by describe_secret")

    fake = _ExplodingOnValueClient(secret_string="ghp_abc123")
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client", lambda *a, **kw: fake
    )

    ok = await describe_secret("weave/tenant/scm-project/github-token")

    assert ok is True
    assert fake.describe_calls == ["weave/tenant/scm-project/github-token"]


async def test_describe_secret_reraises_unexpected_client_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _BrokenClient(_FakeSecretsClient):
        def describe_secret(self, *, SecretId: str) -> dict[str, Any]:
            error = {"Error": {"Code": "AccessDenied", "Message": "no"}}
            raise ClientError(error, "DescribeSecret")

    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client",
        lambda *a, **kw: _BrokenClient(secret_string=None),
    )

    with pytest.raises(ClientError):
        await describe_secret("weave/tenant/scm-project/github-token")

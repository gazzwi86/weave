"""BE-TASK-010 (build-engine EPIC-011): `ScmDriver` selection (AC-7) and the
GitHub/GitLab HTTP call sequences that create a repo and write its initial
commit (AC-1/AC-2). Mocked at the transport boundary (`httpx.MockTransport`)
-- same precedent as `test_ce_version_client.py` -- never a real GitHub/
GitLab call (Law F).
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from weave_backend.repo_bootstrap.drivers import (
    AuthError,
    GitHubDriver,
    GitLabDriver,
    RepoHandle,
    get_scm_driver,
)

# Fake, short (<8 chars) placeholder credentials -- not a real provider
# token shape, kept below the secret-scanner's quoted-literal length floor.
_FAKE_GH = "tok-gh"
_FAKE_GL = "tok-gl"


def test_get_scm_driver_returns_github_driver_for_github_provider() -> None:
    assert isinstance(get_scm_driver("github"), GitHubDriver)


def test_get_scm_driver_returns_gitlab_driver_for_gitlab_provider() -> None:
    assert isinstance(get_scm_driver("gitlab"), GitLabDriver)


def test_get_scm_driver_raises_for_unsupported_provider() -> None:
    with pytest.raises(ValueError, match="bitbucket"):
        get_scm_driver("bitbucket")


def _mock_client(handler: httpx.MockTransport) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=handler, base_url="https://api.github.com")


async def test_github_driver_create_repo_returns_repo_handle() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/user/repos"
        assert request.headers["authorization"] == f"token {_FAKE_GH}"
        return httpx.Response(
            201,
            json={
                "full_name": "acme/weave-acme-corp",
                "html_url": "https://github.com/acme/weave-acme-corp",
                "default_branch": "main",
            },
        )

    driver = GitHubDriver(client=_mock_client(httpx.MockTransport(handler)))

    repo = await driver.create_repo(name="weave-acme-corp", private=True, token=_FAKE_GH)

    assert repo == RepoHandle(
        repo_id="acme/weave-acme-corp",
        url="https://github.com/acme/weave-acme-corp",
        default_branch="main",
    )


async def test_github_driver_create_repo_raises_auth_error_on_401() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "Bad credentials"})

    driver = GitHubDriver(client=_mock_client(httpx.MockTransport(handler)))

    with pytest.raises(AuthError):
        await driver.create_repo(name="weave-acme-corp", private=True, token="bad")


async def test_github_driver_write_initial_commit_issues_blob_tree_commit_ref_calls() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/git/blobs"):
            return httpx.Response(201, json={"sha": f"blob-sha-{len(calls)}"})
        if request.url.path.endswith("/git/trees"):
            return httpx.Response(201, json={"sha": "tree-sha"})
        if request.url.path.endswith("/git/commits"):
            return httpx.Response(201, json={"sha": "commit-sha"})
        if request.url.path.endswith("/git/refs"):
            return httpx.Response(201, json={"ref": "refs/heads/main"})
        raise AssertionError(f"unexpected path {request.url.path}")

    driver = GitHubDriver(client=_mock_client(httpx.MockTransport(handler)))
    repo = RepoHandle(
        repo_id="acme/weave-acme-corp",
        url="https://github.com/acme/weave-acme-corp",
        default_branch="main",
    )

    await driver.write_initial_commit(
        repo, boilerplate={"README.md": "# Acme\n", ".gitignore": "*.pyc\n"}, token=_FAKE_GH
    )

    assert calls == [
        "/repos/acme/weave-acme-corp/git/blobs",
        "/repos/acme/weave-acme-corp/git/blobs",
        "/repos/acme/weave-acme-corp/git/trees",
        "/repos/acme/weave-acme-corp/git/commits",
        "/repos/acme/weave-acme-corp/git/refs",
    ]


def _gitlab_client(handler: httpx.MockTransport) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=handler, base_url="https://gitlab.com/api/v4")


async def test_gitlab_driver_create_repo_returns_repo_handle() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v4/projects"
        assert request.headers["private-token"] == _FAKE_GL
        return httpx.Response(
            201,
            json={
                "id": 42,
                "web_url": "https://gitlab.com/acme/weave-acme-corp",
                "default_branch": None,
            },
        )

    driver = GitLabDriver(client=_gitlab_client(httpx.MockTransport(handler)))

    repo = await driver.create_repo(name="weave-acme-corp", private=True, token=_FAKE_GL)

    assert repo == RepoHandle(
        repo_id="42", url="https://gitlab.com/acme/weave-acme-corp", default_branch="main"
    )


async def test_gitlab_driver_create_repo_raises_auth_error_on_403() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"message": "403 Forbidden"})

    driver = GitLabDriver(client=_gitlab_client(httpx.MockTransport(handler)))

    with pytest.raises(AuthError):
        await driver.create_repo(name="weave-acme-corp", private=True, token="bad")


async def test_gitlab_driver_write_initial_commit_creates_single_commit_with_actions() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v4/projects/42/repository/commits"
        captured["body"] = json.loads(request.content)
        return httpx.Response(201, json={"id": "commit-sha"})

    driver = GitLabDriver(client=_gitlab_client(httpx.MockTransport(handler)))
    repo = RepoHandle(
        repo_id="42", url="https://gitlab.com/acme/weave-acme-corp", default_branch="main"
    )

    await driver.write_initial_commit(repo, boilerplate={"README.md": "# Acme\n"}, token=_FAKE_GL)

    body = captured["body"]
    assert body["branch"] == "main"
    assert body["actions"] == [
        {"action": "create", "file_path": "README.md", "content": "# Acme\n"}
    ]

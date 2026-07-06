"""BE-TASK-010 (build-engine EPIC-011): one `ScmDriver` interface with a
`GitHubDriver`/`GitLabDriver` implementation each, selected by the
project's configured provider (AC-7) -- `get_scm_driver` is the *only*
place that branches on the provider string (task brief's implementation
hint). Each driver creates a private repo and writes the boilerplate as one
initial commit on the default branch (AC-1/AC-2). Real GitHub/GitLab HTTP
calls only outside tests; Law F -- tests inject a `httpx.MockTransport`-backed
client, never a real provider call.
"""

from __future__ import annotations

import os
from typing import Protocol

import httpx
from pydantic import BaseModel

SUPPORTED_PROVIDERS = ["github", "gitlab"]

DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com"
DEFAULT_GITLAB_API_BASE_URL = "https://gitlab.com/api/v4"


class RepoHandle(BaseModel):
    """The opaque handle persisted on `projects` (task brief's
    implementation hint) so a later step (TASK-008) needs no re-resolution.
    """

    repo_id: str
    url: str
    default_branch: str


class AuthError(Exception):
    """Raised by a driver when the provider rejects the auth token --
    `ensure_project_repo` turns this into the fail-closed
    `repo_auth_invalid` error (AC-4), never a Weave-internal fallback.
    """


class ScmDriver(Protocol):
    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle: ...

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None: ...


def _raise_if_auth_error(response: httpx.Response) -> None:
    if response.status_code in (401, 403):
        raise AuthError(f"provider rejected token (status {response.status_code})")
    response.raise_for_status()


async def _post_checked(
    client: httpx.AsyncClient, path: str, body: dict[str, object], headers: dict[str, str]
) -> httpx.Response:
    response = await client.post(path, json=body, headers=headers)
    _raise_if_auth_error(response)
    return response


class GitHubDriver:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        base_url = os.environ.get("GITHUB_API_BASE_URL", DEFAULT_GITHUB_API_BASE_URL)
        self._client = client or httpx.AsyncClient(base_url=base_url, timeout=10.0)

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        headers = {"Authorization": f"token {token}"}
        request_body = {"name": name, "private": private, "auto_init": False}
        response = await _post_checked(self._client, "/user/repos", request_body, headers)
        body = response.json()
        return RepoHandle(
            repo_id=body["full_name"],
            url=body["html_url"],
            default_branch=body.get("default_branch") or "main",
        )

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        # No existing commits on a freshly created repo -- the Git Data API
        # (blob -> tree -> commit -> ref) is the only way to land every
        # boilerplate file in a single initial commit (AC-2); the Contents
        # API creates one commit per file instead.
        headers = {"Authorization": f"token {token}"}
        full_name = repo.repo_id
        tree_entries = []
        for path, content in boilerplate.items():
            blob = await _post_checked(
                self._client,
                f"/repos/{full_name}/git/blobs",
                {"content": content, "encoding": "utf-8"},
                headers,
            )
            tree_entries.append(
                {"path": path, "mode": "100644", "type": "blob", "sha": blob.json()["sha"]}
            )

        tree = await _post_checked(
            self._client, f"/repos/{full_name}/git/trees", {"tree": tree_entries}, headers
        )
        commit = await _post_checked(
            self._client,
            f"/repos/{full_name}/git/commits",
            {"message": "chore: initial commit (Weave Build harness)", "tree": tree.json()["sha"]},
            headers,
        )
        await _post_checked(
            self._client,
            f"/repos/{full_name}/git/refs",
            {"ref": f"refs/heads/{repo.default_branch}", "sha": commit.json()["sha"]},
            headers,
        )


class GitLabDriver:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        base_url = os.environ.get("GITLAB_API_BASE_URL", DEFAULT_GITLAB_API_BASE_URL)
        self._client = client or httpx.AsyncClient(base_url=base_url, timeout=10.0)

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        headers = {"PRIVATE-TOKEN": token}
        visibility = "private" if private else "public"
        response = await _post_checked(
            self._client,
            "/projects",
            {"name": name, "visibility": visibility, "initialize_with_readme": False},
            headers,
        )
        body = response.json()
        return RepoHandle(
            repo_id=str(body["id"]),
            url=body["web_url"],
            default_branch=body.get("default_branch") or "main",
        )

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        # GitLab's commits API accepts multiple file actions in one call --
        # a single commit, unlike GitHub's per-file Contents API (AC-2).
        headers = {"PRIVATE-TOKEN": token}
        actions = [
            {"action": "create", "file_path": path, "content": content}
            for path, content in boilerplate.items()
        ]
        await _post_checked(
            self._client,
            f"/projects/{repo.repo_id}/repository/commits",
            {
                "branch": repo.default_branch,
                "commit_message": "chore: initial commit (Weave Build harness)",
                "actions": actions,
            },
            headers,
        )


def get_scm_driver(provider: str) -> ScmDriver:
    """AC-7: the single provider-string branch point -- callers never
    branch on `provider` themselves.
    """
    if provider == "github":
        return GitHubDriver()
    if provider == "gitlab":
        return GitLabDriver()
    raise ValueError(f"unsupported scm provider: {provider}")

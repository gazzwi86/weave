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
from pathlib import Path
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

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str: ...

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None: ...


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


async def _get_checked(
    client: httpx.AsyncClient, path: str, headers: dict[str, str]
) -> httpx.Response:
    response = await client.get(path, headers=headers)
    _raise_if_auth_error(response)
    return response


async def _put_checked(
    client: httpx.AsyncClient, path: str, body: dict[str, object], headers: dict[str, str]
) -> httpx.Response:
    response = await client.put(path, json=body, headers=headers)
    _raise_if_auth_error(response)
    return response


#: TASK-006 AC-6: one reviewer, no force-push, required status check on the
#: harness CI job (`rich_scaffold`'s `ci_workflow` step names this context).
#: A minimal, provider-agnostic default -- not user-configurable in M1
#: (Implementation Hints name no per-project policy surface for this).
_REQUIRED_STATUS_CHECK_CONTEXT = "weave-harness-check"


def _read_workspace_files(workspace: str) -> dict[str, str]:
    """BE-TASK-008: every file in a generated workspace, keyed by its path
    relative to the workspace root (POSIX separators, for use as a repo
    path in either provider's commit API).
    """
    root = Path(workspace)
    return {
        str(path.relative_to(root).as_posix()): path.read_text(errors="ignore")
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


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

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        """BE-TASK-008 AC-6: commit a generated workspace to a NEW feature
        branch off the current default-branch HEAD (so existing harness
        files from `write_initial_commit` persist), via the same
        blob -> tree -> commit Git Data API sequence, but with `base_tree`
        and `parents` set so this is an incremental commit, not a fresh
        history.
        """
        headers = {"Authorization": f"token {token}"}
        full_name = repo.repo_id
        head_ref = await _get_checked(
            self._client, f"/repos/{full_name}/git/ref/heads/{repo.default_branch}", headers
        )
        parent_sha = head_ref.json()["object"]["sha"]
        # AC-6: `base_tree` on POST /git/trees must be a TREE sha, not a commit
        # sha -- resolve the parent commit to its tree first, else GitHub 422s
        # the tree-create (the ref's object.sha is a commit object).
        parent_commit = await _get_checked(
            self._client, f"/repos/{full_name}/git/commits/{parent_sha}", headers
        )
        base_tree_sha = parent_commit.json()["tree"]["sha"]

        tree_entries = []
        for path, content in _read_workspace_files(workspace).items():
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
            self._client,
            f"/repos/{full_name}/git/trees",
            {"base_tree": base_tree_sha, "tree": tree_entries},
            headers,
        )
        commit = await _post_checked(
            self._client,
            f"/repos/{full_name}/git/commits",
            {"message": message, "tree": tree.json()["sha"], "parents": [parent_sha]},
            headers,
        )
        commit_sha = str(commit.json()["sha"])
        await _post_checked(
            self._client,
            f"/repos/{full_name}/git/refs",
            {"ref": f"refs/heads/{branch}", "sha": commit_sha},
            headers,
        )
        return commit_sha

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        """TASK-006 AC-6: one PUT sets the default branch's protection rule
        set (required review + required status check + no force-push via
        `enforce_admins`). `ScaffoldFailed` (rich_scaffold.py) turns any
        rejection -- auth or otherwise -- into the AC-8 named-step halt.
        """
        headers = {"Authorization": f"token {token}"}
        await _put_checked(
            self._client,
            f"/repos/{repo.repo_id}/branches/{repo.default_branch}/protection",
            {
                "required_status_checks": {
                    "strict": True,
                    "contexts": [_REQUIRED_STATUS_CHECK_CONTEXT],
                },
                "enforce_admins": True,
                "required_pull_request_reviews": {"required_approving_review_count": 1},
                "restrictions": None,
            },
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

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        """BE-TASK-008 AC-6: GitLab's Commits API creates the new branch
        inline via `start_branch` -- one call, unlike GitHub's separate
        blob/tree/commit/ref sequence.
        """
        headers = {"PRIVATE-TOKEN": token}
        actions = [
            {"action": "create", "file_path": path, "content": content}
            for path, content in _read_workspace_files(workspace).items()
        ]
        response = await _post_checked(
            self._client,
            f"/projects/{repo.repo_id}/repository/commits",
            {
                "branch": branch,
                "start_branch": repo.default_branch,
                "commit_message": message,
                "actions": actions,
            },
            headers,
        )
        return str(response.json()["id"])

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        """TASK-006 AC-6: GitLab's Protected Branches API is one POST --
        access level 40 (Maintainer) for both push and merge, same policy
        intent as the GitHub side's required-review + no-direct-push rule.
        """
        headers = {"PRIVATE-TOKEN": token}
        await _post_checked(
            self._client,
            f"/projects/{repo.repo_id}/protected_branches",
            {
                "name": repo.default_branch,
                "push_access_level": 40,
                "merge_access_level": 40,
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

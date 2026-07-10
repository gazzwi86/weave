"""BE-TASK-010/TASK-006 (build-engine EPIC-011): `GitHubDriver` -- the
`ScmDriver` implementation for the `github` provider. Split out of
`drivers.py` (Law E file budget); re-exported from there for callers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import httpx

from weave_backend.repo_bootstrap.scm_http import (
    REQUIRED_STATUS_CHECK_CONTEXT,
    RepoHandle,
    get_checked,
    patch_checked,
    post_checked,
    put_checked,
    read_workspace_files,
)

DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com"


@dataclass(frozen=True)
class _TreeBase:
    """Groups `_resolve_base_tree`'s two return values so `_commit_onto`
    stays under Law E's 5-parameter budget."""

    parent_sha: str
    base_tree_sha: str


class GitHubDriver:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        base_url = os.environ.get("GITHUB_API_BASE_URL", DEFAULT_GITHUB_API_BASE_URL)
        self._client = client or httpx.AsyncClient(base_url=base_url, timeout=10.0)

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        headers = {"Authorization": f"token {token}"}
        request_body = {"name": name, "private": private, "auto_init": False}
        response = await post_checked(self._client, "/user/repos", request_body, headers)
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
        tree_entries = await self._blobs(full_name, boilerplate, headers)

        tree = await post_checked(
            self._client, f"/repos/{full_name}/git/trees", {"tree": tree_entries}, headers
        )
        commit = await post_checked(
            self._client,
            f"/repos/{full_name}/git/commits",
            {"message": "chore: initial commit (Weave Build harness)", "tree": tree.json()["sha"]},
            headers,
        )
        await post_checked(
            self._client,
            f"/repos/{full_name}/git/refs",
            {"ref": f"refs/heads/{repo.default_branch}", "sha": commit.json()["sha"]},
            headers,
        )

    async def _blobs(
        self, full_name: str, files: dict[str, str], headers: dict[str, str]
    ) -> list[dict[str, str]]:
        tree_entries = []
        for path, content in files.items():
            blob = await post_checked(
                self._client,
                f"/repos/{full_name}/git/blobs",
                {"content": content, "encoding": "utf-8"},
                headers,
            )
            tree_entries.append(
                {"path": path, "mode": "100644", "type": "blob", "sha": blob.json()["sha"]}
            )
        return tree_entries

    async def _resolve_base_tree(
        self, full_name: str, branch: str, headers: dict[str, str]
    ) -> _TreeBase:
        """Resolves `branch`'s HEAD to its parent commit + tree sha.
        AC-6: `base_tree` on POST /git/trees must be a TREE sha, not a commit
        sha -- the ref's `object.sha` is a commit object, so it must be
        resolved one hop further or GitHub 422s the tree-create.
        """
        head_ref = await get_checked(
            self._client, f"/repos/{full_name}/git/ref/heads/{branch}", headers
        )
        parent_sha = head_ref.json()["object"]["sha"]
        parent_commit = await get_checked(
            self._client, f"/repos/{full_name}/git/commits/{parent_sha}", headers
        )
        return _TreeBase(parent_sha=parent_sha, base_tree_sha=parent_commit.json()["tree"]["sha"])

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        """BE-TASK-008 AC-6: commit a generated workspace to a NEW feature
        branch off the current default-branch HEAD (so existing harness
        files from `write_initial_commit` persist), via the same
        blob -> tree -> commit Git Data API sequence, but with `base_tree`
        and `parents` set so this is an incremental commit, not a fresh
        history, and a ref CREATE (POST) for the new branch.
        """
        headers = {"Authorization": f"token {token}"}
        full_name = repo.repo_id
        base = await self._resolve_base_tree(full_name, repo.default_branch, headers)
        commit_sha = await self._commit_onto(
            full_name, files=read_workspace_files(workspace), message=message,
            base=base, headers=headers,
        )
        await post_checked(
            self._client,
            f"/repos/{full_name}/git/refs",
            {"ref": f"refs/heads/{branch}", "sha": commit_sha},
            headers,
        )
        return commit_sha

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str:
        """TASK-006 AC-6 (rich scaffold's file-producing steps): add a
        commit directly onto the EXISTING default branch. Unlike
        `write_initial_commit` (fresh history, ref CREATE) and
        `commit_workspace` (ref CREATE for a NEW branch), this PATCHes the
        default branch's existing ref forward -- the branch already has
        commits, so a ref CREATE would 409/422.
        """
        headers = {"Authorization": f"token {token}"}
        full_name = repo.repo_id
        base = await self._resolve_base_tree(full_name, repo.default_branch, headers)
        commit_sha = await self._commit_onto(
            full_name, files=files, message=message, base=base, headers=headers,
        )
        await patch_checked(
            self._client,
            f"/repos/{full_name}/git/refs/heads/{repo.default_branch}",
            {"sha": commit_sha, "force": False},
            headers,
        )
        return commit_sha

    async def _commit_onto(
        self,
        full_name: str,
        *,
        files: dict[str, str],
        message: str,
        base: _TreeBase,
        headers: dict[str, str],
    ) -> str:
        tree_entries = await self._blobs(full_name, files, headers)
        tree = await post_checked(
            self._client,
            f"/repos/{full_name}/git/trees",
            {"base_tree": base.base_tree_sha, "tree": tree_entries},
            headers,
        )
        commit = await post_checked(
            self._client,
            f"/repos/{full_name}/git/commits",
            {"message": message, "tree": tree.json()["sha"], "parents": [base.parent_sha]},
            headers,
        )
        return str(commit.json()["sha"])

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        """TASK-006 AC-6: one PUT sets the default branch's protection rule
        set (required review + required status check + no force-push via
        `enforce_admins`). `ScaffoldFailed` (rich_scaffold.py) turns any
        rejection -- auth or otherwise -- into the AC-8 named-step halt.
        """
        headers = {"Authorization": f"token {token}"}
        await put_checked(
            self._client,
            f"/repos/{repo.repo_id}/branches/{repo.default_branch}/protection",
            {
                "required_status_checks": {
                    "strict": True,
                    "contexts": [REQUIRED_STATUS_CHECK_CONTEXT],
                },
                "enforce_admins": True,
                "required_pull_request_reviews": {"required_approving_review_count": 1},
                "restrictions": None,
            },
            headers,
        )

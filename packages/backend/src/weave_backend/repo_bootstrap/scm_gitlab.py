"""BE-TASK-010/TASK-006 (build-engine EPIC-011): `GitLabDriver` -- the
`ScmDriver` implementation for the `gitlab` provider. Split out of
`drivers.py` (Law E file budget); re-exported from there for callers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from weave_backend.repo_bootstrap.scm_http import (
    RepoHandle,
    get_optional,
    post_checked,
    read_workspace_files,
)

DEFAULT_GITLAB_API_BASE_URL = "https://gitlab.com/api/v4"


@dataclass(frozen=True)
class _CommitTarget:
    """Groups branch + optional `start_branch` so `_commit` stays under
    Law E's 5-parameter budget."""

    branch: str
    start_branch: str | None


class GitLabDriver:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        base_url = os.environ.get("GITLAB_API_BASE_URL", DEFAULT_GITLAB_API_BASE_URL)
        self._client = client or httpx.AsyncClient(base_url=base_url, timeout=10.0)

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        headers = {"PRIVATE-TOKEN": token}
        visibility = "private" if private else "public"
        response = await post_checked(
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

    async def _commit(
        self, repo: RepoHandle, *, target: _CommitTarget, message: str,
        files: dict[str, str], token: str,
    ) -> str:
        # GitLab's commits API accepts multiple file actions in one call --
        # a single commit, whether `branch` is brand new (`start_branch` set)
        # or already exists (subsequent commit onto it, e.g. rich scaffold's
        # file-producing steps) -- unlike GitHub's separate blob/tree/commit/
        # ref Git Data API sequence.
        headers = {"PRIVATE-TOKEN": token}
        actions = [
            {"action": "create", "file_path": path, "content": content}
            for path, content in files.items()
        ]
        body: dict[str, object] = {
            "branch": target.branch, "commit_message": message, "actions": actions,
        }
        if target.start_branch is not None:
            body["start_branch"] = target.start_branch
        response = await post_checked(
            self._client, f"/projects/{repo.repo_id}/repository/commits", body, headers
        )
        return str(response.json()["id"])

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        await self._commit(
            repo, target=_CommitTarget(branch=repo.default_branch, start_branch=None),
            message="chore: initial commit (Weave Build harness)", files=boilerplate, token=token,
        )

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        """BE-TASK-008 AC-6: GitLab's Commits API creates the new branch
        inline via `start_branch` -- one call, unlike GitHub's separate
        blob/tree/commit/ref sequence.
        """
        return await self._commit(
            repo, target=_CommitTarget(branch=branch, start_branch=repo.default_branch),
            message=message, files=read_workspace_files(workspace), token=token,
        )

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str:
        """TASK-006 AC-6 (rich scaffold's file-producing steps): add a
        commit directly onto the EXISTING default branch -- no
        `start_branch` needed, GitLab's Commits API just extends it.
        """
        return await self._commit(
            repo, target=_CommitTarget(branch=repo.default_branch, start_branch=None),
            message=message, files=files, token=token,
        )

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        """TASK-006 AC-6: GitLab's Protected Branches API is one POST --
        access level 40 (Maintainer) for both push and merge, same policy
        intent as the GitHub side's required-review + no-direct-push rule.
        """
        headers = {"PRIVATE-TOKEN": token}
        await post_checked(
            self._client,
            f"/projects/{repo.repo_id}/protected_branches",
            {
                "name": repo.default_branch,
                "push_access_level": 40,
                "merge_access_level": 40,
            },
            headers,
        )

    async def read_file(self, repo: RepoHandle, *, path: str, token: str) -> str | None:
        """TASK-009/AC-2: GitLab's raw-file endpoint returns the file body
        directly (no base64 envelope, unlike GitHub's Contents API) --
        so `load_task_context` can prepend the repo's `ANATOMY.md` into a
        task's context before DELEGATE. A 404 (not yet committed) is a
        normal miss.
        """
        headers = {"PRIVATE-TOKEN": token}
        response = await get_optional(
            self._client,
            f"/projects/{repo.repo_id}/repository/files/{quote(path, safe='')}/raw",
            headers,
            params={"ref": repo.default_branch},
        )
        return response.text if response is not None else None

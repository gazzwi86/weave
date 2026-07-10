"""BE-TASK-010 (build-engine EPIC-011): one `ScmDriver` interface with a
`GitHubDriver`/`GitLabDriver` implementation each (in `scm_github.py`/
`scm_gitlab.py` -- split out to keep this file under Law E's 300-line
budget), selected by the project's configured provider -- `get_scm_driver`
is the *only* place that branches on the provider string (task brief's
implementation hint). Each driver creates a private repo and writes the
boilerplate as one initial commit on the default branch (AC-1/AC-2), plus
(TASK-006 AC-6) applies branch protection and commits rich-scaffold files.
Real GitHub/GitLab HTTP calls only outside tests; Law F -- tests inject a
`httpx.MockTransport`-backed client, never a real provider call.
"""

from __future__ import annotations

from typing import Protocol

from weave_backend.repo_bootstrap.scm_github import GitHubDriver
from weave_backend.repo_bootstrap.scm_gitlab import GitLabDriver
from weave_backend.repo_bootstrap.scm_http import AuthError, RepoHandle

__all__ = [
    "SUPPORTED_PROVIDERS",
    "AuthError",
    "GitHubDriver",
    "GitLabDriver",
    "RepoHandle",
    "ScmDriver",
    "get_scm_driver",
]

SUPPORTED_PROVIDERS = ["github", "gitlab"]


class ScmDriver(Protocol):
    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle: ...

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None: ...

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str: ...

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None: ...

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str: ...


def get_scm_driver(provider: str) -> ScmDriver:
    """AC-7: the single provider-string branch point -- callers never
    branch on `provider` themselves.
    """
    if provider == "github":
        return GitHubDriver()
    if provider == "gitlab":
        return GitLabDriver()
    raise ValueError(f"unsupported scm provider: {provider}")

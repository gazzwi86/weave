"""BE-TASK-010/TASK-006 (build-engine EPIC-011): HTTP call helpers shared by
`scm_github.GitHubDriver` and `scm_gitlab.GitLabDriver` -- split out of
`drivers.py` to keep that file (the `ScmDriver` interface) under Law E's
300-line file budget once TASK-006 added branch-protection/file-commit
methods to both drivers.
"""

from __future__ import annotations

from pathlib import Path

import httpx
from pydantic import BaseModel


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


#: TASK-006 AC-6: one reviewer, no force-push, required status check on the
#: harness CI job (`rich_scaffold`'s `ci_workflow` step names this context).
#: A minimal, provider-agnostic default -- not user-configurable in M1
#: (Implementation Hints name no per-project policy surface for this).
REQUIRED_STATUS_CHECK_CONTEXT = "weave-harness-check"


def _raise_if_auth_error(response: httpx.Response) -> None:
    if response.status_code in (401, 403):
        raise AuthError(f"provider rejected token (status {response.status_code})")
    response.raise_for_status()


async def post_checked(
    client: httpx.AsyncClient, path: str, body: dict[str, object], headers: dict[str, str]
) -> httpx.Response:
    response = await client.post(path, json=body, headers=headers)
    _raise_if_auth_error(response)
    return response


async def get_checked(
    client: httpx.AsyncClient, path: str, headers: dict[str, str]
) -> httpx.Response:
    response = await client.get(path, headers=headers)
    _raise_if_auth_error(response)
    return response


async def get_optional(
    client: httpx.AsyncClient,
    path: str,
    headers: dict[str, str],
    *,
    params: dict[str, str] | None = None,
) -> httpx.Response | None:
    """Same as `get_checked`, but a 404 is a normal miss (`None`), not an
    error -- TASK-009/AC-2's `read_file` (a not-yet-committed `ANATOMY.md`
    on a freshly scaffolded repo is expected, never a failure).
    """
    response = await client.get(path, headers=headers, params=params)
    if response.status_code == 404:
        return None
    _raise_if_auth_error(response)
    return response


async def put_checked(
    client: httpx.AsyncClient, path: str, body: dict[str, object], headers: dict[str, str]
) -> httpx.Response:
    response = await client.put(path, json=body, headers=headers)
    _raise_if_auth_error(response)
    return response


async def patch_checked(
    client: httpx.AsyncClient, path: str, body: dict[str, object], headers: dict[str, str]
) -> httpx.Response:
    response = await client.patch(path, json=body, headers=headers)
    _raise_if_auth_error(response)
    return response


def read_workspace_files(workspace: str) -> dict[str, str]:
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

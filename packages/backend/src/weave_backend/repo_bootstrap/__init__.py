"""BE-TASK-010 (build-engine EPIC-011, FR-061): external project repo
bootstrap -- run step 0. See `service.ensure_project_repo`.
"""

from __future__ import annotations

from weave_backend.repo_bootstrap.service import (
    DEFAULT_DEPS,
    ProjectNotFoundError,
    RepoBootstrapDeps,
    RepoBootstrapError,
    ensure_project_repo,
)

__all__ = [
    "DEFAULT_DEPS",
    "ProjectNotFoundError",
    "RepoBootstrapDeps",
    "RepoBootstrapError",
    "ensure_project_repo",
]

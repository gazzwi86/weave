"""BE-TASK-010 (build-engine EPIC-011) AC-2: the boilerplate/harness file
set written as a freshly bootstrapped project repo's initial commit.

Deliberately minimal for M1 (README, gitignore, conventional-commit config,
a provider-appropriate CI stub) -- FR-062's rich scaffold (branch
protection, full CI, a complete `.claude`-style harness) plus the
environment-verification HITL gate is M2, out of scope here. Kept in its
own module (not merged into `service.py`) so the harness can evolve
without touching the generation pipeline, per the task brief's
implementation hint.
"""

from __future__ import annotations

_GITHUB_CI_STUB = """name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Weave Build harness placeholder -- real pipeline ships M2 (FR-062)"
"""

_GITLAB_CI_STUB = """build:
  script:
    - echo "Weave Build harness placeholder -- real pipeline ships M2 (FR-062)"
"""

_COMMITLINT_CONFIG = '{"extends": ["@commitlint/config-conventional"]}\n'

_GITIGNORE = "node_modules/\n.venv/\n__pycache__/\n*.pyc\n.env\n"


def _readme(project_name: str) -> str:
    return (
        f"# {project_name}\n\n"
        "Generated and operated by Weave's Build engine. This repository is the "
        "source of truth for all generated output -- nothing is generated inside "
        "Weave itself.\n"
    )


def render_project_harness(*, project_name: str, provider: str) -> dict[str, str]:
    """Renders the initial-commit file set (AC-2): README, gitignore,
    conventional-commit config, and a provider-appropriate CI stub. Returns
    a ``{path: content}`` mapping ready for a driver's `write_initial_commit`.
    """
    files = {
        "README.md": _readme(project_name),
        ".gitignore": _GITIGNORE,
        "commitlint.config.json": _COMMITLINT_CONFIG,
    }
    if provider == "github":
        files[".github/workflows/ci.yml"] = _GITHUB_CI_STUB
    else:
        files[".gitlab-ci.yml"] = _GITLAB_CI_STUB
    return files

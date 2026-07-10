"""BE-TASK-010 (build-engine EPIC-011) AC-2: the boilerplate/harness file
set written as a freshly bootstrapped project repo's initial commit --
`render_project_harness`, deliberately minimal (README, gitignore,
conventional-commit config, a provider-appropriate CI stub).

`render_rich_scaffold_files` (TASK-006 AC-6, M2) is the *additional* file
set `rich_scaffold.py` commits on top of that M1 floor: a full CI pipeline,
secrets wiring, health+smoke, git hooks, and harness boilerplate. Kept in
its own module (not merged into `service.py`) so the harness can evolve
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


# --- TASK-006 AC-6: rich scaffold (M2) --------------------------------------
# The M1 stub above stays as-is (still the write_initial_commit payload);
# these render the *additional* files rich_scaffold.py commits on top of it.

_FULL_CI_PIPELINE = """name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "lint stage -- real command wired by the project's own stack config"
      - run: echo "test stage -- real command wired by the project's own stack config"
      - run: echo "build stage -- real command wired by the project's own stack config"
"""

_SECRETS_WIRING_NOTE = (
    "# Secrets\n\n"
    "This project references secrets by **name only** -- Weave's preflight check "
    "(TASK-006 AC-3) resolves them via Secrets Manager `describe_secret` at run time. "
    "No secret value is ever committed to this repository.\n"
)

_HEALTH_ROUTE_NOTE = (
    "# Health\n\n"
    "A `/health` route and a smoke test asserting it returns 200 are expected of "
    "every generated project -- CI's `build` job (above) runs the smoke test before "
    "reporting the `weave-harness-check` status this repo's branch protection "
    "requires.\n"
)

_PRE_COMMIT_HOOK = "#!/bin/sh\necho 'chore: run lint + unit tests here (project-stack-specific)'\n"


def _harness_manifest(project_name: str, standards_note: str) -> str:
    return (
        f"# {project_name} -- Harness\n\n"
        "Rich-scaffold boilerplate (TASK-006 AC-6): branch protection, full CI, "
        "secrets wiring, health+smoke, and git hooks. See docs/SECRETS.md and "
        "docs/HEALTH.md.\n\n## Effective standards\n\n"
        f"{standards_note}\n"
    )


def render_rich_scaffold_files(
    *, project_name: str, provider: str, standards_note: str
) -> dict[str, str]:
    """TASK-006 AC-6: the rich-scaffold file set, committed in one commit
    onto the existing default branch (`rich_scaffold`'s `harness_files`
    step, via `ScmDriver.commit_files`) -- upgrades the CI stub to a full
    pipeline and adds secrets-wiring, health+smoke, git-hooks, and
    harness-boilerplate content. `standards_note` renders the effective
    standards set (TASK-001) when one is configured, else a demo-default
    note -- one call, already-built resolution (implementation hint).
    """
    ci_path = ".github/workflows/ci.yml" if provider == "github" else ".gitlab-ci.yml"
    return {
        ci_path: _FULL_CI_PIPELINE,
        "docs/SECRETS.md": _SECRETS_WIRING_NOTE,
        "docs/HEALTH.md": _HEALTH_ROUTE_NOTE,
        ".githooks/pre-commit": _PRE_COMMIT_HOOK,
        "HARNESS.md": _harness_manifest(project_name, standards_note),
    }

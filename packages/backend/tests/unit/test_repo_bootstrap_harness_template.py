"""BE-TASK-010 (build-engine EPIC-011) AC-2: the boilerplate/harness file
set written as the new repo's initial commit. M1 scope only -- FR-062's
rich scaffold (branch protection, full CI, complete `.claude`-style
harness) is out of scope here (task brief's "Design Decisions" table).
"""

from __future__ import annotations

from weave_backend.repo_bootstrap.harness_template import render_project_harness


def test_render_project_harness_includes_readme_naming_the_project() -> None:
    files = render_project_harness(project_name="Acme Corp", provider="github")
    assert "Acme Corp" in files["README.md"]


def test_render_project_harness_includes_gitignore_and_commitlint_config() -> None:
    files = render_project_harness(project_name="Acme Corp", provider="github")
    assert ".gitignore" in files
    assert "commitlint.config.json" in files
    assert "@commitlint/config-conventional" in files["commitlint.config.json"]


def test_render_project_harness_github_provider_gets_github_actions_stub() -> None:
    files = render_project_harness(project_name="Acme Corp", provider="github")
    assert ".github/workflows/ci.yml" in files
    assert ".gitlab-ci.yml" not in files


def test_render_project_harness_gitlab_provider_gets_gitlab_ci_stub() -> None:
    files = render_project_harness(project_name="Acme Corp", provider="gitlab")
    assert ".gitlab-ci.yml" in files
    assert ".github/workflows/ci.yml" not in files


def test_render_project_harness_handles_unicode_and_markdown_special_chars_in_name() -> None:
    """QA edge case: `project_name` is free-text (BE-TASK-001's `name` field,
    up to 120 chars, only checked for non-empty-after-slugify) -- it can
    contain unicode, quotes, or markdown-significant characters. Rendering
    must not raise, and the raw name is embedded verbatim (no template engine
    involved, so no injection surface beyond what a README already is).
    """
    files = render_project_harness(project_name='Acme "Co" — <日本語> *bold*', provider="github")
    assert 'Acme "Co" — <日本語> *bold*' in files["README.md"]

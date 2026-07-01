---
type: Coding Standard
title: "CI — Python + uv (github-actions)"
description: "Golden GitHub Actions workflow for a Weave Python service: uv-managed install from the lockfile, ruff lint + format check, mypy --strict, pytest with coverage gate, all on PR; any AWS step assumes an IAM role via OIDC (id-token: write) with least privilege — never long-lived keys."
tags: [standards, patterns, ci, github-actions]
timestamp: 2026-07-01
resource: docs/standards/patterns/ci/github-actions-python-uv.md
topic: ci
stack: github-actions
verification: "python3 yaml.safe_load PASS (valid YAML, 'jobs' key present); actionlint unavailable (no go/brew) — yaml-parse is the achieved level"
---

# CI — Python + uv (github-actions)

## Intent

The CI workflow for a Weave Python 3.12+ FastAPI service (`uv` only — bare `pip`
is blocked). On every pull request it must, in order: install dependencies
reproducibly from `uv.lock`, lint and format-check with **ruff** (line-length
100, mccabe max 10), type-check with **mypy --strict** (the pydantic plugin is
configured in `pyproject.toml`), then run **pytest** with the coverage gate
(`--cov-fail-under=80`). Lint/type/test run with **zero AWS access** — they need
no credentials. Only a step that genuinely touches AWS (e.g. an integration test
against LocalStack-free real services, or a deploy) requests an OIDC token and
assumes a least-privilege IAM role. There are **no `AWS_ACCESS_KEY_ID` secrets**
anywhere in the repo.

```yaml
# .github/workflows/ci-python.yml
name: CI (Python)

on:
  pull_request:
  push:
    branches: [main]

# Least privilege at the workflow level: read-only by default.
# Jobs that need more (OIDC, PR comments) opt in explicitly.
permissions:
  contents: read

concurrency:
  group: ci-python-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Lint · Type · Test
    runs-on: ubuntu-latest
    # No id-token here — lint/type/test must not be able to touch AWS.
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1

      - name: Install uv
        uses: astral-sh/setup-uv@d0cc045d04ccac9d8b7881df0226f9e82c39688e  # v6.8.0
        with:
          enable-cache: true
          cache-dependency-glob: uv.lock

      - name: Set up Python 3.12
        run: uv python install 3.12

      - name: Install dependencies (locked)
        run: uv sync --frozen --all-extras

      # -- Lint ----------------------------------------------------------------
      - name: Ruff lint
        run: uv run ruff check . --output-format=github

      - name: Ruff format check
        run: uv run ruff format --check .

      # -- Type check ----------------------------------------------------------
      - name: mypy (strict)
        run: uv run mypy app --strict

      # -- Tests + coverage ----------------------------------------------------
      - name: pytest + coverage
        run: |
          uv run pytest \
            --cov=app \
            --cov-report=xml:coverage.xml \
            --cov-report=term-missing \
            --cov-fail-under=80

      - name: Upload coverage artifact
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
        with:
          name: coverage-xml
          path: coverage.xml
          retention-days: 3

  # Example: a job that DOES need AWS (integration smoke against real services).
  # Runs only after quality passes. This is where OIDC lives — nowhere else.
  aws-integration:
    name: AWS integration smoke
    needs: quality
    runs-on: ubuntu-latest
    # Gate real-AWS access behind a GitHub Environment (protection rules apply).
    environment: dev
    permissions:
      id-token: write   # REQUIRED for OIDC — exchange GH token for AWS creds
      contents: read
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1

      - name: Install uv
        uses: astral-sh/setup-uv@d0cc045d04ccac9d8b7881df0226f9e82c39688e  # v6.8.0
        with:
          enable-cache: true
          cache-dependency-glob: uv.lock

      - name: Set up Python 3.12
        run: uv python install 3.12

      - name: Install dependencies (locked)
        run: uv sync --frozen

      # OIDC: no stored keys. Assume a least-privilege, per-run session.
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@7474bc4690e29a8392af63c5b98e7449536d5c3a  # v4.3.1
        with:
          role-to-assume: ${{ vars.AWS_CI_ROLE_ARN }}   # arn:aws:iam::<acct>:role/weave-ci-python
          aws-region: ${{ vars.AWS_REGION }}
          role-session-name: gha-python-${{ github.run_id }}

      - name: Integration tests (real AWS, marked)
        run: uv run pytest -m integration --no-cov
```

**Why:** `uv sync --frozen` installs exactly what `uv.lock` pins — reproducible,
and it fails if the lockfile is stale. `ruff check --output-format=github` surfaces
findings as inline PR annotations. `mypy --strict` and `--cov-fail-under=80` are
hard gates matching the Weave testing standard (line 80% blocks merge). Splitting
`quality` from `aws-integration` keeps AWS credentials out of the lint/type/test
job entirely.

**Security:**
- **OIDC, not static keys.** `aws-actions/configure-aws-credentials@v4` exchanges
  the workflow's OIDC token for a short-lived STS session (~1h). There is no
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secret to leak or rotate — matching
  Weave's "AWS Secrets Manager only, machine auth = IAM role via STS" rule.
- **`permissions: id-token: write` is scoped to the one job that needs it.** The
  workflow default is `contents: read`; the `quality` job cannot mint an AWS token.
- **Least-privilege role.** `AWS_CI_ROLE_ARN` points at a role whose trust policy
  restricts `token.actions.githubusercontent.com:sub` to `repo:<org>/<repo>:*`
  (ideally to a specific branch/environment), and whose permission policy grants
  only what the smoke test needs.
- **Environment protection.** The AWS job declares `environment: dev`, so GitHub
  Environment protection rules (required reviewers, branch restrictions, wait
  timers) apply before it runs.
- **SHA-pinned actions.** Every third-party `uses:` is pinned to a full 40-char
  commit SHA with a trailing `# vX.Y` comment — mandatory here because these jobs
  hold `id-token: write`, so a re-tagged or compromised action (cf.
  tj-actions/changed-files, Mar 2025) could otherwise mint AWS STS credentials.
  A floating tag (`@v4`) is a moving target; renovate/dependabot bumps the SHAs
  and keeps the version comment current.

**Anti-patterns:**
- Storing `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` as repo secrets — forbidden;
  use OIDC.
- Granting `id-token: write` (or `contents: write`) at the workflow top level "just
  in case" — grant per job, minimally.
- `uv pip install` / bare `pip` / committing `requirements.txt` — use `uv sync
  --frozen`; export with `uv export --frozen` only for Docker.
- `uv sync` without `--frozen` in CI — allows silent lockfile drift.
- Skipping `--cov-fail-under` or adding `|| true` to a lint/type step — defeats the
  gate.
- A trust policy with `sub` = `repo:<org>/<repo>:*` but no environment/branch
  narrowing on a role that can deploy — over-broad; scope it.

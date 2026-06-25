---
topic: ci
stack: python
references:
  - docs/stack-equivalents.md
---

# GitHub Actions — Python with uv: ruff, mypy, pytest, coverage comment, matrix 3.11/3.12

uv 0.4+, Ruff, mypy strict, pytest-cov. Coverage comment posted on PRs.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: CI (Python ${{ matrix.python }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        python: ["3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          version: "0.4"
          enable-cache: true
          cache-dependency-glob: "uv.lock"

      - name: Set up Python ${{ matrix.python }}
        run: uv python install ${{ matrix.python }}

      - name: Install dependencies
        run: uv sync --frozen --all-extras

      # -- Lint ----------------------------------------------------------------
      - name: Ruff lint
        run: uv run ruff check . --output-format=github

      - name: Ruff format check
        run: uv run ruff format --check .

      # -- Type check ----------------------------------------------------------
      - name: mypy
        run: uv run mypy src --strict

      # -- Tests + coverage ----------------------------------------------------
      - name: pytest
        run: |
          uv run pytest \
            --cov=src \
            --cov-report=xml:coverage.xml \
            --cov-report=term-missing \
            --cov-fail-under=80 \
            -v
        env:
          PYTHONDONTWRITEBYTECODE: "1"

      - name: Upload coverage (3.12 only)
        if: matrix.python == '3.12'
        uses: actions/upload-artifact@v4
        with:
          name: coverage-xml
          path: coverage.xml
          retention-days: 3

  # Post coverage comment on PRs
  coverage-comment:
    needs: ci
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/download-artifact@v4
        with: { name: coverage-xml }
      - uses: py-cov-action/python-coverage-comment-action@v3
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          COVERAGE_PATH: coverage.xml
          MINIMUM_GREEN: 80
          MINIMUM_ORANGE: 60
```

**Why:** `uv sync --frozen` uses the lockfile — reproducible installs.
`--output-format=github` emits Ruff findings as GitHub annotations in the PR
diff. `--cov-fail-under=80` gates the pipeline on minimum coverage.

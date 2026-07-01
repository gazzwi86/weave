---
type: Coding Standard
title: Python Tooling — Coding Standard
description: "Python tooling overlay: uv, ruff, type checking."
tags: [standards, tooling, python]
timestamp: 2026-06-29T00:00:00Z
resource: docs/standards/tooling-py.md
---

# Python — tooling overlay

> TypeScript tooling: see [`tooling-ts.md`](tooling-ts.md).

Package manager: **uv** (enforced; bare `pip` is blocked by a Claude Code hook).
Python target: **3.12+** (match `pyproject.toml` `requires-python`).

## Project setup

```bash
uv init
uv add fastapi pydantic uvicorn
uv add --dev pytest pytest-cov pytest-asyncio ruff radon mypy mutmut
```

All dependencies live in `pyproject.toml`. Never commit a `requirements.txt` — use
`uv export --frozen` to generate one for Docker layers when needed.

## Formatter + linter: ruff

ruff replaces black, isort, flake8, and mccabe in a single tool.

**`pyproject.toml` (tool.ruff section):**

```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
  "E", "W",   # pycodestyle
  "F",        # pyflakes
  "I",        # isort
  "B",        # flake8-bugbear
  "C9",       # mccabe complexity
  "UP",       # pyupgrade (enforce 3.12+ idioms)
  "PLR",      # pylint refactor (param count, statement count)
]
ignore = ["E501"]  # line length handled by formatter

[tool.ruff.lint.mccabe]
max-complexity = 10

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

Run: `uv run ruff check . --fix && uv run ruff format .`

## Type checking: mypy

```toml
[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = false
plugins = ["pydantic.mypy"]
```

Run: `uv run mypy .`

**Principle:** strict mypy means `--disallow-untyped-defs`, `--no-implicit-optional`,
`--warn-return-any`. Never add `# type: ignore` without a comment explaining why.

## Complexity: radon

ruff C901 catches cyclomatic violations at lint time. radon gives deeper reporting
when you need it:

```bash
uv run radon cc src -a -nc    # cyclomatic — expect A/B (pass) across all files
uv run radon mi src           # maintainability index — expect A band
```

These are not CI gates on their own; ruff C901 is the gate. Radon is for investigation.

## Pre-commit hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic, types-all]
```

Install: `uv run pre-commit install`

Pre-push: `uv run pytest --tb=short` (full suite). Wired via `.pre-commit-config.yaml`
`stages: [push]` or as a separate pre-push script.

## Docstring style (Google)

```python
def validate_shape(graph: Graph, shape_uri: URIRef) -> list[ValidationResult]:
    """Validate a SHACL shape against the graph.

    Args:
        graph: The RDF graph to validate.
        shape_uri: URI of the sh:NodeShape to apply.

    Returns:
        List of ValidationResult; empty list means valid.

    Raises:
        ShapeNotFoundError: If shape_uri does not resolve to a NodeShape.
    """
```

Public API functions and Pydantic models require a Google-style docstring.
Internal helpers may omit if the name and types are self-evident.

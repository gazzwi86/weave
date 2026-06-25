# Python — tooling overlay

## Package manager

**uv** by default (fast, resolver-correct, single-binary install). Poetry and
pip-tools permitted per brief.

```bash
uv init
uv add fastapi pydantic-settings
uv add --dev pytest ruff mypy pytest-cov hypothesis
uv run pytest
uv run ruff check src tests
```

## Python version

**3.12** minimum. Target `py312` in `[tool.ruff]` and `python_version = "3.12"`
in `[tool.mypy]`.

## Pre-commit

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.7.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        args: [--strict]
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
```

Install hooks:

```bash
uv tool install pre-commit
pre-commit install --hook-type pre-commit --hook-type pre-push
```

Pre-push hook runs full `pytest` + `uv pip audit`.

## Docstring style (Google)

```python
def calculate_score(numbers: list[int], bonus: float) -> int:
    """Calculate the player's score.

    Args:
        numbers: Values collected during the round.
        bonus: Multiplier from the current phase. Must be non-negative.

    Returns:
        The total score (non-negative).

    Raises:
        ValueError: If bonus is negative.
    """
```

Public APIs require a docstring. mypy `--strict` forces typed signatures.

## Secrets / env validation

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    stripe_secret_key: str
    class Config:
        env_file = ".env"

settings = Settings()  # validates at startup
```

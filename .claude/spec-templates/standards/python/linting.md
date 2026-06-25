# Python — linting overlay

## Toolchain

- **Ruff** — fast linter + formatter; replaces flake8, black, isort.
- **mypy** — strict static typing.
- **Bandit** — security linter (runs via Ruff `S` rules + standalone).

## pyproject.toml (starter)

```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
  "E", "F", "W",        # pycodestyle + pyflakes
  "I",                  # isort
  "B",                  # bugbear
  "C4",                 # comprehensions
  "C901",               # mccabe (cyclomatic)
  "PLR0911","PLR0912","PLR0913","PLR0915","PLR1702",  # pylint refactor (params, branches, nesting)
  "S",                  # bandit security
  "UP",                 # pyupgrade
  "SIM",                # simplify
  "RUF"
]
ignore = []

[tool.ruff.lint.mccabe]
max-complexity = 10          # Plugin Law E

[tool.ruff.lint.pylint]
max-args = 5
max-branches = 12
max-returns = 6
max-statements = 50
max-nested-blocks = 4

[tool.ruff.format]
quote-style = "double"

[tool.mypy]
python_version = "3.12"
strict = true
warn_unused_ignores = true
disallow_untyped_defs = true
no_implicit_optional = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra -q --strict-markers"
```

## Cognitive complexity

Ruff does not yet enforce cognitive complexity natively. Install
`flake8-cognitive-complexity` in CI as a secondary check:

```bash
uv pip install flake8-cognitive-complexity
flake8 --select=CCR001 --max-cognitive-complexity=15 src/
```

Alternative: `lizard -C 10 -L 50 -a 5 src/` (cyclomatic ≤ 10, length ≤ 50,
args ≤ 5) as a stack-agnostic analyser.

## Waiver syntax

```python
def parse_legacy_payload(data: bytes) -> Payload:  # noqa: C901 -- weave: allow-complex reason="binary dispatch on 12 variants, unrolling harms readability"
    ...
```

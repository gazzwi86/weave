---
topic: linting
stack: python
references:
  - docs/stack-equivalents.md
  - templates/standards/base/complexity.md
---

# Ruff + mypy strict — Plugin Law E thresholds + flake8-cognitive-complexity

pyproject.toml block for Ruff 0.4+ and mypy 1.10+.
`flake8-cognitive-complexity` supplements Ruff for cognitive complexity.

```toml
# pyproject.toml

[tool.ruff]
target-version = "py312"
line-length     = 100
src             = ["src", "tests"]

[tool.ruff.lint]
select = [
  "E", "W",    # pycodestyle
  "F",         # pyflakes
  "I",         # isort
  "N",         # pep8-naming
  "UP",        # pyupgrade
  "B",         # flake8-bugbear
  "C4",        # flake8-comprehensions
  "S",         # flake8-bandit (security)
  "SIM",       # flake8-simplify
  "C90",       # mccabe (maps to C901 complexity check)
  "PLR",       # pylint refactor (complexity gates)
  "PLW",       # pylint warnings
  "RUF",       # ruff-specific
]

ignore = [
  "S101",    # allow assert in tests
  "B008",    # allow function calls in default arg (FastAPI Depends pattern)
  "N805",    # allow 'cls' in pydantic validators
]

# -- Plugin Law E: complexity gates ------------------------------------------
[tool.ruff.lint.mccabe]
max-complexity = 10             # C901: cyclomatic ≤ 10

[tool.ruff.lint.pylint]
max-args      = 5               # PLR0913: params ≤ 5
max-branches  = 10              # PLR0912: branches ≤ 10
max-statements = 50             # PLR0915: statements ≤ 50 (proxy for fn length)
max-returns   = 4               # PLR0911: returns ≤ 4
max-nested-blocks = 4           # PLR1702: nesting ≤ 4

# Per-file overrides — relax in tests
[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S", "PLR0913", "PLR0915"]   # allow more args + statements in tests

[tool.ruff.format]
quote-style    = "double"
indent-style   = "space"
line-ending    = "auto"

# -- mypy strict -------------------------------------------------------------
[tool.mypy]
python_version          = "3.12"
strict                  = true
warn_return_any         = true
warn_unused_ignores     = true
disallow_untyped_defs   = true
disallow_any_generics   = true
pretty                  = true
show_error_context      = true

[[tool.mypy.overrides]]
module = ["tests.*"]
disallow_untyped_defs = false
```

```ini
# .flake8 — cognitive complexity supplement (flake8-cognitive-complexity)
# Ruff doesn't yet have cognitive complexity; use this alongside Ruff.
[flake8]
max-cognitive-complexity = 15   # Plugin Law E: cognitive ≤ 15
extend-select = CCR001          # cognitive complexity rule
per-file-ignores =
    tests/*: CCR001             # relax in tests
```

```bash
# Install
uv add --dev ruff mypy flake8 flake8-cognitive-complexity

# Run
ruff check . --fix
ruff format .
mypy src --strict
flake8 src --select CCR001      # cognitive complexity only
```

```python
# Waiver syntax (Plugin Law E)
def handle(event):  # noqa: C901, PLR0912 -- weave: allow-complex reason="dispatch on 9-variant event enum; splitting obscures control flow"
    ...
```

**Why:** Ruff replaces flake8 + isort + pyupgrade in one tool. `flake8-cognitive-
complexity` fills the cognitive-complexity gap until Ruff ships its own rule.
`mypy strict` catches `Any`-typed return values that silently escape type safety.

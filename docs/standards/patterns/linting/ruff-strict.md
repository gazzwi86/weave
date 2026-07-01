---
type: Coding Standard
title: "Linting — strict ruff config for the Law E complexity budget (python)"
description: A ruff config enforcing cyclomatic <=10, param/branch/statement budgets, imports, and security, with FastAPI DI exempted from B008.
tags: [standards, patterns, linting, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/linting/ruff-strict.md
topic: linting
stack: python
verification: "ruff 0.15.20 loaded the config without error; `ruff check --config ruff.toml sample.py` clean on a FastAPI Depends() handler (extend-immutable-calls suppresses the B008 that would otherwise fire)"
---

# Linting — strict ruff config for the Law E complexity budget (python)

The single Python lint gate. `ruff` replaces black, isort, flake8, mccabe, and bandit. This config
enforces the parts of the Law E complexity budget that ruff can enforce, plus import order and
security, and exempts FastAPI's dependency-injection idiom from the `B008` false positive.

```toml
# ruff.toml — Weave Python lint gate (line-length/target mirror pyproject.toml)
line-length = 100
target-version = "py312"

[lint]
select = [
  "E", "W",   # pycodestyle
  "F",        # pyflakes — unused / undefined names
  "I",        # isort — import ordering
  "B",        # flake8-bugbear — likely bugs
  "C90",      # mccabe — cyclomatic complexity
  "UP",       # pyupgrade — enforce 3.12+ idioms
  "PLR",      # pylint refactor — arg / branch / statement budgets
  "S",        # flake8-bandit — security
]
ignore = ["E501"]  # line length is a formatter concern, not a lint failure

[lint.mccabe]
max-complexity = 10          # Law E: cyclomatic <= 10                 (C901)

[lint.pylint]
max-args = 5                 # Law E: params <= 5                      (PLR0913)
max-branches = 12            # branch budget                          (PLR0912)
max-statements = 50          # function-size proxy: <= ~50 statements (PLR0915)

[lint.flake8-bugbear]
# FastAPI DI is call-in-default by design (Depends/Query/Path/Header/Body) — not a B008 bug.
extend-immutable-calls = [
  "fastapi.Depends",
  "fastapi.Query",
  "fastapi.Path",
  "fastapi.Header",
  "fastapi.Body",
]

[lint.isort]
known-first-party = ["app"]

[lint.per-file-ignores]
"tests/**" = ["S101", "PLR2004"]  # asserts and magic values are acceptable in tests
```

**What ruff enforces vs. what it cannot.** ruff covers the numeric parts of Law E it has rules for:
cyclomatic complexity (`C901`, `max-complexity=10`), parameter count (`PLR0913`, `max-args=5`),
branch count (`PLR0912`), and statement count (`PLR0915`, a proxy for the "function <= 50 lines"
limit). ruff has **no** rule for **cognitive complexity**, **per-function line count**, **file length
(<= 300 lines)**, or **nesting depth (<= 4)** — enforce those via `radon` and code review per
`complexity.md` (the TypeScript side uses `sonarjs/cognitive-complexity`). Do not claim ruff gates
what it does not.

**Why:** one tool, one config, deterministic in CI and pre-commit; the complexity ceilings fail the
build rather than relying on reviewer vigilance. `known-first-party = ["app"]` gives stable
first-party import grouping so `I` never churns diffs.
**Security:** the `S` (bandit) rules catch hardcoded secrets, `assert` used for control flow in
production paths, `subprocess`/`shell=True`, and insecure hashes at lint time — a cheap first gate
ahead of the dedicated secret scanner.
**Anti-patterns:** selecting `B` without `extend-immutable-calls`, which makes the config reject every
FastAPI handler (`B008`); silencing findings with a bare `# noqa` instead of a specific
`# noqa: <code> — reason`; raising `max-complexity` to pass a hot function instead of decomposing it;
disabling `S` because it is "noisy" — narrow it with `per-file-ignores`, never drop it wholesale.

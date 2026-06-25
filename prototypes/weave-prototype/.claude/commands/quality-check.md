---
description: Run all quality gates — ruff, radon CC+MI, eslint, typecheck
allowed-tools: Bash
---

Run every quality gate and report a consolidated pass/fail summary.

## Backend: ruff lint

```bash
cd /Users/gareth/Sites/Weave/backend && .venv/bin/ruff check .
```

Configured in `pyproject.toml`: line-length 100, rules E/F/I/B/UP/C90, mccabe max-complexity 10.

## Backend: cyclomatic complexity (radon)

```bash
cd /Users/gareth/Sites/Weave/backend && .venv/bin/radon cc app -a -nc
```

Target: all functions rank A or B. Flag any that rank C or worse.

## Backend: maintainability index (radon)

```bash
cd /Users/gareth/Sites/Weave/backend && .venv/bin/radon mi app
```

Target: all modules rank A. Flag any that rank B or worse.

## Backend: xenon complexity gate

```bash
cd /Users/gareth/Sites/Weave/backend && .venv/bin/xenon app --max-absolute B
```

Fails if any module exceeds grade B.

## Frontend: eslint

```bash
cd /Users/gareth/Sites/Weave/frontend && npm run lint
```

## Frontend: TypeScript type check

```bash
cd /Users/gareth/Sites/Weave/frontend && npm run typecheck
```

## Summary

After running all steps, report:
- Each gate: PASS or FAIL
- For failures: the specific errors or offending symbols
- Overall: PASS (all green) or FAIL (any red)

Do not proceed to commit if any gate is red.

---
description: Run the full test suite — backend pytest, frontend vitest, and Playwright e2e
allowed-tools: Bash
---

Run all tests in the correct order. Report a summary of failures at the end.

## Backend tests

```bash
cd /Users/gareth/Sites/Weave/backend && .venv/bin/python -m pytest
```

If the venv does not exist, create it first:
```bash
cd /Users/gareth/Sites/Weave/backend && python3 -m venv .venv && .venv/bin/pip -q install -e ".[dev]"
```

## Frontend unit tests

```bash
cd /Users/gareth/Sites/Weave/frontend && npm run test
```

## Frontend type check

```bash
cd /Users/gareth/Sites/Weave/frontend && npm run typecheck
```

## Frontend e2e (Playwright)

```bash
cd /Users/gareth/Sites/Weave/frontend && npm run test:e2e
```

Note: `test:e2e` requires Playwright browsers to be installed. If the run fails with a browser-not-found error, run `npx playwright install --with-deps` first. In some CI sandboxes the browser download is blocked — mark the step as skipped rather than failing the overall report.

## Summary

After running all steps, report:
- Which suites passed/failed
- Failure counts and the first error from each failing suite
- Any suite that was skipped and why

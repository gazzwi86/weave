# Git safety rules

- **Never bypass git hooks.** `git push --no-verify`, `git commit --no-verify`, and `git commit -n`
  skip the pre-commit and pre-push gates that enforce harness quality (lint/format/tests on
  pre-commit; `check-anatomy-fresh`, `check-harness-manifest`, and `ui_verify` on pre-push).
  These flags are blocked by the `check-git-safety` PreToolUse hook (`modules/git_safety.py`).
- If a hook is wrong or too slow, **fix the hook** — do not skip it. A skipped gate is an unenforced
  gate.
- A flag mentioned inside a quoted commit message (e.g. `-m "ban --no-verify"`) is fine; only the
  real flag is blocked.
- `git push --force` is already denied in `settings.json` permissions; force-push remains forbidden.

## Enforcement

The `check-git-safety` PreToolUse hook (`modules/git_safety.py`) blocks the flags at the tool
level (exit 2): `git commit --no-verify` / `-n`, `git push --no-verify`. `git push --force` is
denied via `settings.json` permissions. Local hooks are commit-fast (secrets + lint) with
Semgrep + manifest/OKF parity at push; the heavy test pyramid runs in CI and per task in the
engineer/QA loop — so there is never a legitimate reason to skip a gate.

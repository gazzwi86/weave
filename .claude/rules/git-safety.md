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

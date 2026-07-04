# Git safety rules

- **Never bypass git hooks.** `git push --no-verify`, `git commit --no-verify`, and `git commit -n`
  skip the pre-commit and pre-push gates that enforce harness quality (lint/format/tests on
  pre-commit; `check-anatomy-fresh`, `check-harness-manifest`, and `ui_verify` on pre-push).
  These flags are blocked by the `check-git-safety` PreToolUse hook (`modules/git_safety.py`).
- If a hook is wrong or too slow, **fix the hook** — do not skip it. A skipped gate is an unenforced
  gate.
- A flag mentioned inside a quoted commit message (e.g. `-m "ban --no-verify"`) is fine; only the
  real flag is blocked.

## Force-push policy (stacked PRs)

Stacked PRs must be **restacked** (rebased onto their merged base) each time the base epic lands,
which requires a force-push. A blanket ban made that impossible, so the policy is nuanced — enforced
by `check_force_push` in `modules/git_safety.py`, not a settings.json glob:

- **`git push --force-with-lease` on a `feature/*` branch is allowed** — this is how a PR is
  restacked. `--force-with-lease` refuses to overwrite if the remote moved since you fetched, so it
  cannot silently clobber another push.
- **A bare `git push --force` / `-f` is refused everywhere.** It overwrites unconditionally. Always
  use `--force-with-lease`.
- **Any force-push at `main` / `master` is refused**, with or without lease — including `+refspec`
  force syntax and a no-refspec `--force-with-lease` while HEAD is on `main`. **This hook is the
  SOLE enforcement:** this repo has no server-side branch protection (private repo on a plan without
  protected branches). If the repo later gains branch protection, the hook stays as defence in depth.

## Enforcement

The `check-git-safety` PreToolUse hook (`modules/git_safety.py`) blocks bypasses at the tool level
(exit 2): `git commit --no-verify` / `-n`, `git push --no-verify` (`check_no_verify`), and the
force-push rules above (`check_force_push`, regression-tested in
`.claude/scripts/tests/test_git_safety_force.py`). Local hooks are commit-fast (secrets + lint) with
Semgrep + manifest/OKF parity at push; the heavy test pyramid runs in CI and per task in the
engineer/QA loop — so there is never a legitimate reason to skip a gate.

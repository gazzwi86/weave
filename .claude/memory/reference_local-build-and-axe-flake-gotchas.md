---
name: Local build (Next 16 turbopack) + axe-m2 flake gotchas
description: Two dev-env gotchas that cost real debugging in the UI-refit session — the explorer-a11y-m2 axe flake, and polluted deps breaking local next build
type: reference
created: 2026-07-19
---

Two non-obvious gotchas, each of which cost real time during the 2026-07 UI refit:

1. **`explorer-a11y-m2` axe-core panels test WAS FLAKY (root fix landed #167, 2026-07-19).** It
   false-failed on PRs #149, #152, #158, #164. Root cause: the scan raced the ControlDock accordion
   panel MOUNT — the panel wrapper `<div>` persists across tab switches, so a generic "panel open"
   wait passed instantly on tabs 2–4 before React committed the new content. Fixed in #167: a
   per-tab `data-testid` (`control-dock-panel-<tabId>`) that the spec awaits before each scan; the
   CompanySwitcher was never the cause (closed Radix dialog, not in the DOM during the scan).
   **Residual: base-sensitivity is separate and remains** — a stale base can still redden the job
   from OTHER PRs' churn, so on a red run rerun + rebase-check before assuming a real regression.

2. **Fresh git worktrees have NO deps installed.** Agents sometimes symlink the main checkout's
   `node_modules` into a worktree (lockfiles match) to build fast — but Next 16 **Turbopack rejects a
   symlinked node_modules** ("Symlink … points out of the filesystem root"), so `next dev`/`next build`
   fail there. Worse: a root-level clean-install (the `ci` variant) deletes/relinks deps and can leave
   the main frontend checkout with `next` MISSING, so local `next build` then fails on turbopack
   workspace-root inference ("couldn't find next/package.json from …/frontend/app") — even though CI is
   green with the same `turbopack.root` config. **Fix: a clean dependency reinstall inside
   `packages/frontend`** restores it and the build works again. CI is never affected (fresh runner).

**Why:** both read as scary "real" failures (a11y regression / build broken by the refit) but are
local/CI-hygiene artifacts. Recognising them avoids hours of misdirected debugging.
**How to apply:** before treating an axe-m2 red or a local `next build` turbopack error as a code
defect, rerun/rebase (axe) or reinstall the frontend deps (build). Related: [[reference_epic-close-ci-discipline]].

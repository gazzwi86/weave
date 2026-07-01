# `.claude/scripts/` — runnable hook + setup scripts

Everything here is invoked from `settings.json` or from a slash command —
not directly by Claude. These scripts are deterministic; Claude just
triggers them by editing files / calling tools / starting a session.

## Files

### `hooks.py` (the central dispatcher)

One Python entrypoint, dispatched on a sub-command:

```sh
python3 .claude/scripts/hooks.py <event> [check]
```

Where `<event>` is:

| Event | When it fires | What this dispatcher does |
|---|---|---|
| `pre-tool-use check-no-secrets` | Before every Edit / Write | Greps new content for hardcoded secrets, API keys, and dangerous patterns. Blocks (exit 2) on a hit. |
| `pre-tool-use check-uv-over-pip` | Before every Edit / Write / Bash | Blocks bare `pip install`, `python -m pip install`, `--break-system-packages`. Allows `uv pip install`, `uvx`, `uv tool install`. See `.claude/rules/python-tooling.md`. |
| `post-tool-use check-circular-deps` | (not wired) | **Parked.** The `modules/circular_deps.py` module is kept, but its dispatch entry has been removed from `hooks.py` (no `check-circular-deps` slot). It was a CommonJS `require()` walker; the rewrite is TS+ESM. Re-enable by re-adding the dispatch entry and pointing it at `madge --circular`. |
| `post-tool-use mark-anatomy-stale` | After every Edit / Write | Looks up the touched file's wiki page via `area_for_path()` and appends a stale-marker comment (`<!-- stale: <file> -->`). |
| `notification` | When Claude sends a notification | Echoes to stderr. |
| `user-prompt-submit` | Before each user prompt is sent | Nudges the project-memory skill when the prompt contains a save-trigger keyword. |
| `stop` | When the main agent stops | (1) Memory flush nudge — warns if save-trigger keywords appeared but no memory file was written. (2) **Drift detector** — estimates transcript token usage, and (if above the gate %) asks a local LLM (ollama / lm studio) whether to `/compact`, `/clear`, or do nothing. |
| `subagent-stop` | When a subagent stops | Reads `.claude/state/summaries/<task_id>.md` and injects it into the parent agent's context via stderr — how the orchestrator sees what a subagent built without re-reading code. (Not a no-op.) |
| `pre-compact` | Before context compaction | Writes `.claude/state/summaries/latest.md` (progress.json + latest `PHASE-*.md`) so state survives the compaction. (Not a no-op.) |
| `session-start` | At session start | (1) Injects `MEMORY.md` index into context. (2) Warns if git hooks aren't wired (`/setup` to fix). |
| `session-end` | At session end | Writes the `summaries/latest.md` snapshot and forces a full transcript snapshot via `audit`. (Not a no-op.) |
| `check-anatomy-fresh` | Manual / pre-push hook | Scans `docs/wiki/` for stale markers; exit 1 with file list if any. |
| `check-harness-manifest` | Manual / pre-push hook | Structural row-parity gate for `.claude/HARNESS.md`. Delegates to `harness_manifest.check`: exit 2 if a discovered harness element has no row; WARN (exit 0) on unvouched/stale rows. See "Harness manifest" below. |

### Module structure

`hooks.py` is a thin harness (~60 lines). Each logical concern lives in its own
module under `modules/`:

| Module | Purpose |
|---|---|
| `modules/common.py` | Shared utilities: `PROJECT_ROOT`, `area_for_path()`, `block()`, `rel_from_root()`, transcript helpers |
| `modules/secrets.py` | PreToolUse: secret scanner and dangerous-pattern guard |
| `modules/python_tooling.py` | PreToolUse: enforce uv-only Python tooling (Edit / Write / Bash) |
| `modules/wiki.py` | PostToolUse: `mark_anatomy_stale`, `check_anatomy_fresh` |
| `modules/git_safety.py` | PreToolUse:Bash: block `git push/commit --no-verify` and `commit -n` (no hook bypass) |
| `modules/stop.py` | Stop: context drift detection (token estimate + local LLM) |
| `modules/memory.py` | Stop nudge, `user_prompt_submit`, session-start memory injection |
| `modules/lifecycle.py` | `notification`, `check_setup_status`, `subagent_stop`, `pre_compact`, `session_end` |
| `modules/install_safety.py` | PreToolUse:Bash: block install of nonexistent/slopsquatted npm/pip packages |
| `modules/audit.py` | All events: append-only event log + transcript snapshots (`.claude/logs/`, gitignored) |
| `modules/circular_deps.py` | Circular-dep check — **parked**: module kept, dispatch entry removed from `hooks.py`. Re-enable via `madge --circular`. |

### Path → wiki area mapping

The `area_for_path()` function in `modules/common.py` is what makes the wiki
LLM-maintainable: each touched file maps to exactly one wiki page so
stale markers don't multiply. Current mapping:

```
apps/web/lib/audio/<file>          → docs/wiki/web-audio.md
apps/web/components/<group>/<file> → docs/wiki/web-<group>.md
apps/web/app/(...)/page.tsx        → docs/wiki/web-pages.md
apps/web/<top>/<sub>/...           → docs/wiki/web-<top>.md
apps/api/src/<sub>/<file>          → docs/wiki/api-<sub>.md
apps/api/tests/<file>              → docs/wiki/api-tests.md
packages/<name>/...                → docs/wiki/<name>.md
infra/<sub>/...                    → docs/wiki/infra-<sub>.md
```

Top-level files in any of these areas (e.g. `apps/web/tsconfig.json`)
are intentionally *not* tracked — `len(parts) >= 4` gate. See
`tests/hooks_test.py` for the locked contract.

### `statusline.sh`

Shell script that prints the custom Claude Code status line. Wired via
`settings.json` `statusLine.command`.

### `git-hooks/`

`pre-commit`, `pre-push`. Wired via `git config core.hooksPath
.claude/scripts/git-hooks` by `/setup`. The pre-push hook runs two manifest
gates: `hooks.py check-anatomy-fresh` (advisory — warns on stale wiki) and
`hooks.py check-harness-manifest` (**blocking** — see below).

### `harness_manifest.py` — the harness manifest

`.claude/HARNESS.md` is a DERIVED manifest: one table row per harness element
(skill, agent, top-level script, hook module), with `Element | Type | Purpose |
Invoked by | Breaks without it | Status | last-vouched-by` columns. It is the
anti-slop legibility ledger — every moving part of the harness must be accounted
for and (eventually) vouched for by a human.

```sh
python3 .claude/scripts/harness_manifest.py generate   # (re)write HARNESS.md
python3 .claude/scripts/harness_manifest.py --check     # structural parity gate
```

- **`generate`** scans the harness and writes the table. It **preserves
  human-authored cells** (`Purpose`, `Invoked by`, `Breaks without it`,
  `last-vouched-by`) across regeneration — only NEW elements get a stub row
  (`Purpose` seeded from the element's frontmatter `description`,
  `last-vouched-by: TODO`). Elements that have disappeared keep their row,
  flipped to `Status: STALE — element removed`. The prose above the table is
  regenerated each run, so only edit table cells.
- **`--check`** is the pre-push gate, also reachable as the
  `check-harness-manifest` hooks.py handler. **Structural row-parity is the hard
  rule**: every discovered element MUST have a row, else it exits 2 and the push
  is blocked. A `TODO`/empty `last-vouched-by` on an active element is only a
  WARN to stderr (never a failure) — this avoids a bootstrap deadlock where no
  push is possible until every row is hand-vouched. Stale rows also WARN. A
  human vouches for a row by replacing `TODO` with `<name> <date>` once the row
  is confirmed accurate.

Unlike `check-anatomy-fresh` (advisory), the pre-push wrapper for
`check-harness-manifest` propagates the exit code, so a parity failure genuinely
blocks the push.

## How to add a new hook

1. Add a function to the relevant module in `modules/` (or create a new one).
2. Register it in the appropriate dispatch table in `hooks.py` (`PRE_TOOL_USE_CHECKS`,
   `POST_TOOL_USE_CHECKS`, or `EVENT_HANDLERS`).
3. Wire `settings.json` to call `python3 ${CLAUDE_PROJECT_DIR}/.claude/scripts/hooks.py <event> <name>`.
4. Add a test in `../tests/hooks_test.py`.
5. If it's a security check, return exit code 2 to block; otherwise let it return 0.

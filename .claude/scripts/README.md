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
| `post-tool-use check-circular-deps` | After every Edit / Write | **Disabled.** Was a CommonJS `require()` walker; the rewrite is TS+ESM. Keep the slot — re-enable with `madge --circular` if needed. |
| `post-tool-use mark-anatomy-stale` | After every Edit / Write | Looks up the touched file's wiki page via `area_for_path()` and appends a stale-marker comment (`<!-- stale: <file> -->`). |
| `post-tool-use claude-review` | After every Edit / Write | Spawns `claude -p` with a security-linter prompt over the new content. Async. No-op if `claude` CLI isn't on PATH. |
| `notification` | When Claude sends a notification | Echoes to stderr. |
| `user-prompt-submit` | Before each user prompt is sent | Nudges the project-memory skill when the prompt contains a save-trigger keyword. |
| `stop` | When the main agent stops | (1) Memory flush nudge — warns if save-trigger keywords appeared but no memory file was written. (2) **Drift detector** — estimates transcript token usage, and (if above the gate %) asks a local LLM (ollama / lm studio) whether to `/compact`, `/clear`, or do nothing. |
| `subagent-stop` | When a subagent stops | No-op. |
| `pre-compact` | Before context compaction | No-op. |
| `session-start` | At session start | (1) Injects `MEMORY.md` index into context. (2) Warns if git hooks aren't wired (`/setup` to fix). |
| `session-end` | At session end | No-op. |
| `check-anatomy-fresh` | Manual / pre-push hook | Scans `docs/wiki/` for stale markers; exit 1 with file list if any. |

### Module structure

`hooks.py` is a thin harness (~60 lines). Each logical concern lives in its own
module under `modules/`:

| Module | Purpose |
|---|---|
| `modules/common.py` | Shared utilities: `PROJECT_ROOT`, `area_for_path()`, `block()`, `rel_from_root()`, transcript helpers |
| `modules/secrets.py` | PreToolUse: secret scanner and dangerous-pattern guard |
| `modules/python_tooling.py` | PreToolUse: enforce uv-only Python tooling (Edit / Write / Bash) |
| `modules/wiki.py` | PostToolUse: `mark_anatomy_stale`, `check_anatomy_fresh` |
| `modules/eslint.py` | PostToolUse: ESLint security lint |
| `modules/stop.py` | Stop: context drift detection (token estimate + local LLM) |
| `modules/memory.py` | Stop nudge, `user_prompt_submit`, session-start memory injection |
| `modules/lifecycle.py` | `notification`, `check_setup_status`, `subagent_stop`, `pre_compact`, `session_end` |
| `modules/circular_deps.py` | PostToolUse: circular dep check — **disabled**, full DFS kept for re-enable |
| `modules/claude_review.py` | PostToolUse: LLM security review — **disabled** (too expensive for always-on) |

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
.claude/scripts/git-hooks` by `/setup`. The pre-push hook calls
`hooks.py check-anatomy-fresh` to block pushes when the wiki is stale.

## How to add a new hook

1. Add a function to the relevant module in `modules/` (or create a new one).
2. Register it in the appropriate dispatch table in `hooks.py` (`PRE_TOOL_USE_CHECKS`,
   `POST_TOOL_USE_CHECKS`, or `EVENT_HANDLERS`).
3. Wire `settings.json` to call `python3 ${CLAUDE_PROJECT_DIR}/.claude/scripts/hooks.py <event> <name>`.
4. Add a test in `../tests/hooks_test.py`.
5. If it's a security check, return exit code 2 to block; otherwise let it return 0.

#!/usr/bin/env python3
"""Hook dispatcher for Claude Code.

Settings.json wires every hook to:

    python3 ${CLAUDE_PROJECT_DIR}/.claude/scripts/hooks.py <event> [check]

`event` is the hook event name; `check` is an optional sub-handler for
events that fan out to multiple checks. Each handler receives the hook
payload (parsed JSON from stdin). Exit codes drive behaviour:

  0  approve / no-op (default)
  2  block — message on stderr is shown to Claude

Each module in modules/ owns one logical concern. To add a new hook:
  1. Add a function to the relevant module (or create a new one).
  2. Register it in the dispatch table below.
  3. Wire settings.json: python3 .claude/scripts/hooks.py <event> <name>
  4. Add a test in ../.claude/tests/hooks_test.py.
"""

import sys

from modules import common
from modules import secrets, wiki, eslint, stop
from modules import memory, lifecycle, circular_deps, claude_review, python_tooling
from modules import install_safety

PRE_TOOL_USE_CHECKS = {
    "check-no-secrets":     [secrets.check_no_secrets],
    "check-uv-over-pip":   [python_tooling.check_uv_over_pip],
    "check-install-safety": [install_safety.check_install_safety],
}

POST_TOOL_USE_CHECKS = {
    "check-circular-deps":   [circular_deps.check_circular_deps],
    "mark-anatomy-stale":    [wiki.mark_anatomy_stale],
    "commit-progress":       [lifecycle.commit_progress],
    "claude-review":         [claude_review.claude_review],
    "check-eslint-security": [eslint.check_eslint_security],
}

EVENT_HANDLERS = {
    "notification":         [lifecycle.notification],
    "user-prompt-submit":   [memory.user_prompt_submit],
    "stop":                 [memory.flush_nudge_on_stop, stop.phase_gate, stop.drift_check],
    "subagent-stop":        [lifecycle.subagent_stop],
    "pre-compact":          [lifecycle.pre_compact],
    "session-start":        [memory.inject_memory_index, lifecycle.check_setup_status],
    "session-end":          [lifecycle.session_end],
    # CLI-only — invoked by the pre-push git hook, not wired in settings.json
    "check-anatomy-fresh":  [wiki.check_anatomy_fresh],
}


def _run(handlers: list, payload: dict) -> None:
    for h in handlers:
        h(payload)


def main(argv: list) -> None:
    if len(argv) < 2:
        sys.stderr.write(f"usage: {argv[0]} <event> [check]\n")
        sys.exit(64)

    event = argv[1]
    check = argv[2] if len(argv) > 2 else None
    payload = common.read_payload()

    # Audit trail (best-effort, never raises): record every hook invocation; audit.observe() owns
    # the policy of when to also snapshot the transcript. Import stays inside the guard so a broken
    # audit module can never take down the hooks. See modules/audit.py.
    try:
        from modules import audit
        audit.observe(event, check, payload)
    except Exception:
        pass

    if event == "pre-tool-use":
        _run(PRE_TOOL_USE_CHECKS.get(check or "", []), payload)
        return

    if event == "post-tool-use":
        _run(POST_TOOL_USE_CHECKS.get(check or "", []), payload)
        return

    handlers = EVENT_HANDLERS.get(event)
    if not handlers:
        sys.stderr.write(f"hooks.py: unknown event '{event}'\n")
        sys.exit(64)
    _run(handlers, payload)


if __name__ == "__main__":
    main(sys.argv)

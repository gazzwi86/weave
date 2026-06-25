"""PostToolUse: LLM-based security review — disabled (too expensive for always-on)."""

import json
import re
import subprocess
import sys
from shutil import which

from modules.common import block


def claude_review(payload: dict) -> None:
    """PostToolUse:Edit|Write — shell out to `claude -p` for an LLM review.

    DISABLED in settings.json (per-edit LLM calls are too expensive for always-on).
    Kept here so .claude/examples/expensive-hooks.json can reference it.
    To re-enable: add to PostToolUse hooks in settings.local.json.
    See also: the `prompt:` hook variant in examples/expensive-hooks.json.
    """
    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or ""
    if not re.search(r"(?:^|/)(?:apps|packages)/.+\.(?:ts|tsx|js)$", file_path):
        return

    content = tool_input.get("content") or tool_input.get("new_string") or ""
    if not content.strip():
        return

    if not which("claude"):
        return  # offline / CI without the CLI — no-op

    prompt = (
        "You are a security linter. Inspect the file content below and respond with "
        'JSON ONLY: {"block":true,"reason":"..."} on a violation '
        '(hardcoded secrets, eval/Function, SQL injection, command injection), or '
        '{"block":false} otherwise.\n\n'
        f"File: {file_path}\n---\n{content[:8000]}\n"
    )
    try:
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "text"],
            capture_output=True, text=True, timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError):
        return

    try:
        verdict = json.loads(result.stdout.strip())
    except (json.JSONDecodeError, AttributeError):
        return

    if verdict.get("block"):
        block(f"claude-review: {verdict.get('reason', 'flagged by /security-review')}")

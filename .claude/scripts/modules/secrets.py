"""PreToolUse: block writes containing hardcoded secrets or dangerous patterns."""

import re

from modules.common import block

SECRET_PATTERNS = [
    re.compile(r"""(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']""", re.IGNORECASE),
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),
    # Provider credential shapes — kept in sync with the git pre-commit secret scan so the
    # edit-time guard is no weaker than the commit-time one.
    re.compile(r"AKIA[0-9A-Z]{16}"),       # AWS access key id
    re.compile(r"ghp_[A-Za-z0-9]{36}"),    # GitHub personal access token
    re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----"),
    # Dynamic code execution — dangerous in API/shared where no eslint safety net
    re.compile(r"\beval\s*\("),
    re.compile(r"\bnew\s+Function\s*\("),
]

_TEST_FILE_RE = re.compile(r"\.(?:test|spec)\.(?:ts|tsx|js|mjs)$")


def check_no_secrets(payload: dict) -> None:
    """PreToolUse:Edit|Write — block writes containing hardcoded secrets or dangerous patterns.

    Skips *.test.ts / *.spec.ts files — test fixtures legitimately use dummy secrets and
    eval is sometimes used in sandboxed assertion helpers.
    """
    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or ""

    if not re.search(r"(?:^|/)(?:apps|packages|infra|\.claude/scripts)/", file_path):
        return

    if _TEST_FILE_RE.search(file_path):
        return

    content = tool_input.get("content") or tool_input.get("new_string") or ""
    if not content:
        return

    for pattern in SECRET_PATTERNS:
        m = pattern.search(content)
        if m:
            preview = m.group(0)[:40] + "..."
            block(f"check-no-secrets: potential secret in {file_path} -> {preview}")

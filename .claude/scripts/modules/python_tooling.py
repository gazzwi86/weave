"""PreToolUse: enforce uv over pip for Python tooling. Mirrors .claude/rules/python-tooling.md."""

import re

from modules.common import block

# Strip the allowed form ('uv pip install ...', any whitespace) before scanning.
# Anything that still matches `pip install` after stripping is a real violation.
_ALLOWED_UV_PIP = re.compile(r"\buv\s+pip\s+install\b")
_PIP_PATTERN = re.compile(r"\b(?:pip3?|python3?\s+-m\s+pip)\s+install\b")
_BREAK_SYSTEM = re.compile(r"--break-system-packages\b")

# Strip single/double-quoted strings and heredoc bodies before scanning Bash commands —
# the substring may appear inside a commit message, doc string, echo arg, or here-doc payload.
_QUOTED_RE = re.compile(r"'[^']*'|\"[^\"]*\"")
_HEREDOC_RE = re.compile(r"<<-?\s*'?(\w+)'?.*?^\1$", re.DOTALL | re.MULTILINE)

# Files/dirs that may legitimately contain forbidden literals (rule docs, tests, the
# linter's own source). One-tuple-per-rule: (suffix or None, substring fragment).
_EXEMPT_PATH_RULES = (
    (None, "/.claude/scripts/"),
    (None, "/tests/"),
    (".md", "/rules/"),
    (".md", "/docs/"),
    (".md", "/skills/"),
    (".md", "/reports/"),
    (".md", "/commands/"),
    (".md", "/memory/"),
)

_FIX = "uv tool install <pkg>, uvx <pkg>, uv add <pkg>, or uv pip install --system <pkg>"


def _scan(text: str, location: str, *, strip_quotes: bool) -> None:
    """Block on bare pip install / --break-system-packages. Fast-path for the common case."""
    if not text:
        return
    if "pip" not in text and "--break-system-packages" not in text:
        return

    if strip_quotes:
        text = _HEREDOC_RE.sub("", text)
        text = _QUOTED_RE.sub("", text)

    # Strip the allowed `uv pip install` form so it doesn't trip _PIP_PATTERN.
    bare = _ALLOWED_UV_PIP.sub("", text)

    if _PIP_PATTERN.search(bare):
        block(
            f"python-tooling: bare pip install in {location}. Use {_FIX}. "
            "See .claude/rules/python-tooling.md."
        )
    if _BREAK_SYSTEM.search(bare):
        block(
            f"python-tooling: --break-system-packages in {location}. "
            "Use uv pip install --system instead. See .claude/rules/python-tooling.md."
        )


def _is_exempt_path(file_path: str) -> bool:
    return any(
        (suffix is None or file_path.endswith(suffix)) and substr in file_path
        for suffix, substr in _EXEMPT_PATH_RULES
    )


def _edit_payload_text(tool_input: dict) -> str:
    """Concatenate the editable text from Edit / Write / MultiEdit payloads."""
    if content := tool_input.get("content"):
        return content
    if new_string := tool_input.get("new_string"):
        return new_string
    edits = tool_input.get("edits") or []
    return "\n".join(e.get("new_string") or "" for e in edits)


def check_uv_over_pip(payload: dict) -> None:
    """PreToolUse:Edit|Write|Bash — block any use of bare pip install."""
    tool_name = payload.get("tool_name") or ""
    tool_input = payload.get("tool_input") or {}

    if tool_name == "Bash":
        _scan(tool_input.get("command") or "", "Bash command", strip_quotes=True)
        return

    if tool_name in ("Edit", "Write", "MultiEdit"):
        file_path = tool_input.get("file_path") or ""
        if _is_exempt_path(file_path):
            return
        _scan(_edit_payload_text(tool_input), file_path or "edited content", strip_quotes=False)

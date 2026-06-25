"""Memory nudges: MEMORY.md injection, prompt triggers, stop-hook flush nudge."""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

from modules.common import PROJECT_ROOT, _last_messages_excerpt

_MEMORY_INDEX = PROJECT_ROOT / ".claude" / "memory" / "MEMORY.md"

_PROJECT_MEMORY_TRIGGERS = re.compile(
    r"\b("
    r"remember|from now on|always|never|"
    r"we (?:decided|agreed|use|prefer|don't|do not|always|never)|"
    r"the team (?:decided|agreed|prefers|uses|wants)|"
    r"in this (?:repo|project|codebase)|"
    r"for this (?:project|codebase|repo)|"
    r"our (?:convention|standard|rule|decision)"
    r")\b",
    re.IGNORECASE,
)


def _read_memory_index() -> Optional[str]:
    """Return MEMORY.md contents, capped at 200 lines (the documented soft limit)."""
    try:
        text = _MEMORY_INDEX.read_text(encoding="utf-8")
    except OSError:
        return None
    lines = text.splitlines()
    if len(lines) > 200:
        lines = lines[:200] + ["", "<!-- truncated at 200 lines -->"]
    return "\n".join(lines).strip()


def inject_memory_index(_payload: dict) -> None:
    """SessionStart — inject MEMORY.md content into context."""
    memory = _read_memory_index()
    if memory:
        sys.stdout.write(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": (
                    "Project memory (committed at .claude/memory/MEMORY.md) — facts "
                    "the agent has learned about this repo, team, and ongoing work. "
                    "Writes are governed by the `project-memory` skill; personal "
                    "preferences continue to go to user-level memory.\n\n"
                    f"{memory}"
                ),
            }
        }) + "\n")


def user_prompt_submit(payload: dict) -> None:
    """Nudge the project-memory skill when the prompt contains a save trigger.

    No automatic writes — the agent decides via the skill body. We only inject
    a hint so the skill description is more likely to surface.
    """
    prompt = (payload.get("prompt") or payload.get("user_prompt") or "").strip()
    if not prompt or not _PROJECT_MEMORY_TRIGGERS.search(prompt):
        return

    sys.stdout.write(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": (
                "project-memory hint: the prompt contains a save-trigger keyword. "
                "Consider invoking the `project-memory` skill to classify and route "
                "this fact to .claude/memory/ (project) or user memory (personal). "
                "Skip if the fact is already covered by CLAUDE.md, rules/, ANATOMY.md, "
                "or git history."
            ),
        }
    }))


def flush_nudge_on_stop(payload: dict) -> None:
    """Stop — nudge user when save-trigger keywords appeared but no memory file was written.

    Deterministic, no LLM call.
    """
    transcript_path = payload.get("transcript_path")
    if not transcript_path:
        return

    memory_dir = PROJECT_ROOT / ".claude" / "memory"
    if not memory_dir.exists():
        return

    excerpt = _last_messages_excerpt(transcript_path, max_messages=10, max_chars=4000)
    if not excerpt or not _PROJECT_MEMORY_TRIGGERS.search(excerpt):
        return

    try:
        transcript_mtime = Path(transcript_path).stat().st_mtime
    except OSError:
        return

    window_start = transcript_mtime - 900  # 15-minute window covers a typical turn
    for entry in memory_dir.iterdir():
        if entry.is_file() and entry.suffix == ".md":
            try:
                if entry.stat().st_mtime >= window_start:
                    return
            except OSError:
                continue

    sys.stderr.write(
        "project-memory: save-trigger keywords detected this turn but no memory "
        "writes. Run /remember to save explicitly, or ignore if not applicable.\n"
    )

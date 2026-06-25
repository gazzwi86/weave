"""Session and notification lifecycle hooks."""

import os
import subprocess
import sys

from modules.common import PROJECT_ROOT


def notification(payload: dict) -> None:
    msg = payload.get("message") or os.environ.get("CLAUDE_NOTIFICATION") or ""
    if msg:
        sys.stderr.write(f"Claude says: {msg}\n")


def check_setup_status(_payload: dict) -> None:
    """SessionStart — warn about missing setup (git hooks)."""
    missing = []

    try:
        result = subprocess.run(
            ["git", "config", "core.hooksPath"],
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=2,
        )
        if result.stdout.strip() != ".claude/scripts/git-hooks":
            missing.append("git hooks not wired (run /setup)")
    except (subprocess.TimeoutExpired, OSError):
        pass

    if missing:
        sys.stderr.write("setup status:\n  - " + "\n  - ".join(missing) + "\n")


def subagent_stop(payload: dict) -> None:
    """After an engineer or QA subagent stops, inject the task summary into parent context.

    The engineer subagent writes .claude/state/summaries/{TASK_ID}.md before it stops.
    This hook reads that file and injects it via stderr so the parent implement skill
    can see what was built without reading all the code directly.
    """
    from pathlib import Path
    import json

    # Extract task_id from the payload or from progress.json current task
    task_id = None

    # Try payload session metadata first
    try:
        session_info = payload.get("session", {})
        task_id = session_info.get("current_task_id")
    except Exception:
        pass

    # Fall back to progress.json in_progress task
    if not task_id:
        try:
            state_path = Path(".claude/state/progress.json")
            if state_path.exists():
                data = json.loads(state_path.read_text())
                for task in data.get("tasks", []):
                    if task.get("status") == "in_progress":
                        task_id = task.get("id")
                        break
        except Exception:
            pass

    if not task_id:
        return  # can't determine task; fail silently

    summary_path = Path(f".claude/state/summaries/{task_id}.md")
    if not summary_path.exists():
        return  # no summary written; engineer may not have finished

    try:
        content = summary_path.read_text(encoding="utf-8")
        if content.strip():
            sys.stderr.write(
                f"[Task summary for {task_id} (from subagent):\n{content}\n]\n"
            )
    except OSError:
        pass  # fail silently — this hook must never block


def commit_progress(payload: dict) -> None:
    """PostToolUse:Edit|Write — auto-commit the state spine after progress.json changes.

    The dark-factory design (see decision_harness-architecture memory) requires
    `.claude/state/progress.json` to be committed after every task so overnight routines and
    fresh clones see accurate state. This handler delivers that.

    Narrow and safe by construction:
      - acts ONLY when the edited file is progress.json;
      - `git add -- <path>` stages ONLY progress.json. This is required: `git commit -- <path>`
        alone fails with "pathspec did not match" when the file has never been tracked (fresh
        clone / new repo — the exact case this exists for), and the error would be swallowed
        silently. Staging first handles that;
      - the pathspec commit (`git commit -- <path>`) then commits ONLY that path, so it can never
        sweep up unrelated staged or working-tree changes;
      - both git calls are no-ops when progress.json is unchanged (nothing staged → "nothing to
        commit", nonzero exit, no commit created);
      - `--no-verify` skips the secret scan / anatomy refresh (pointless for a state file);
      - never blocks — all failures are swallowed.
    """
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    if not file_path.replace("\\", "/").endswith(".claude/state/progress.json"):
        return

    rel = ".claude/state/progress.json"
    try:
        subprocess.run(["git", "add", "--", rel], cwd=PROJECT_ROOT, timeout=5, capture_output=True)
        subprocess.run(
            ["git", "commit", "-q", "--no-verify", "-m", "chore(state): update progress.json", "--", rel],
            cwd=PROJECT_ROOT, timeout=10, capture_output=True,
        )
    except (subprocess.SubprocessError, OSError):
        pass


def pre_compact(_payload: dict) -> None:
    """Fires before context compaction. Snapshot state here if needed."""


def session_end(_payload: dict) -> None:
    """Fires at session end. Flush logs, persist state, etc."""

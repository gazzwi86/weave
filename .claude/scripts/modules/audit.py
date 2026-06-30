"""Session audit trail → .claude/logs/<session_id>/.

Two artefacts per session:

  events.jsonl    — one compact line per hook event we observe (prompt, tool use, stop, …).
                    A live, human-skimmable timeline. Necessarily partial: only the hook events
                    wired in settings.json fire (UserPromptSubmit, PostToolUse:Edit|Write,
                    PreToolUse:Bash, Stop, …), so not every Read/Grep shows up here.
  transcript.jsonl — a full copy of Claude Code's own session transcript, refreshed on every Stop
                    and at SessionEnd. THIS is the complete record: every message, thinking block,
                    tool call and tool result. The events file is a convenience index over it.

Design rules:
  - Never raise. Every entry point swallows its own errors — a broken audit log must never break a
    hook or block the user.
  - Best-effort and cheap. Append-only for events; copy-if-changed for the transcript.

Logs are local-only (gitignored). They can contain secrets/PII from the work — do not commit them.
"""

import json
import shutil
from datetime import datetime, timezone

from modules.common import PROJECT_ROOT

LOG_ROOT = PROJECT_ROOT / ".claude" / "logs"
_MAX_FIELD = 4000  # truncate oversized strings in the event timeline
_DIR_CACHE: dict = {}  # session_id -> Path, so we mkdir once per process not once per event


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _session_id(payload: dict) -> str:
    sid = payload.get("session_id") or (payload.get("session") or {}).get("id")
    if sid:
        return str(sid)
    tp = payload.get("transcript_path")
    if tp:
        return "transcript-" + str(tp).rsplit("/", 1)[-1].removesuffix(".jsonl")
    return "unknown-session"


def _session_dir(payload: dict):
    sid = _session_id(payload)
    d = _DIR_CACHE.get(sid)
    if d is None:
        d = LOG_ROOT / sid
        d.mkdir(parents=True, exist_ok=True)
        _DIR_CACHE[sid] = d
    return d


def _clip(v):
    if isinstance(v, str) and len(v) > _MAX_FIELD:
        return v[:_MAX_FIELD] + f"…(+{len(v) - _MAX_FIELD} chars)"
    return v


def _summarise(event: str, check, payload: dict) -> dict:
    """Pull the few fields worth indexing for each event type."""
    rec = {"ts": _now(), "event": event}
    if check:
        rec["check"] = check

    if event == "user-prompt-submit":
        rec["prompt"] = _clip(payload.get("prompt") or payload.get("user_input") or "")
    elif event in ("pre-tool-use", "post-tool-use"):
        rec["tool"] = payload.get("tool_name")
        ti = payload.get("tool_input") or {}
        # Index the identifying field for the common tools; keep it small.
        for k in ("file_path", "command", "path", "pattern", "url", "skill"):
            if k in ti:
                rec[k] = _clip(ti[k])
                break
        if event == "post-tool-use":
            resp = payload.get("tool_response")
            rec["ok"] = not (isinstance(resp, dict) and resp.get("is_error"))
            # Task-state transitions. When the loop advances a task it shells out to
            # `progress.sh update <task-id> <status>`; record that transition as a compact
            # event line so events.jsonl is a skimmable timeline of how the loop progressed
            # (task_id, status, plus retry_count / pr_url when the caller passes them).
            # NOTE: events.jsonl is local/gitignored telemetry — NOT the checkpoint of record.
            # progress.json (committed on every change) remains the durable checkpoint a resume
            # reconstructs from.
            cmd = ti.get("command") or ""
            if "progress.sh update" in cmd:
                parts = cmd.split("progress.sh update", 1)[1].split()
                if len(parts) >= 2:
                    rec.setdefault("task_id", parts[0])
                    rec.setdefault("status", parts[1])
            for k in ("task_id", "status", "retry_count", "pr_url"):
                if payload.get(k) is not None:
                    rec[k] = _clip(payload[k]) if isinstance(payload[k], str) else payload[k]
    elif event in ("stop", "subagent-stop"):
        rec["stop_active"] = payload.get("stop_hook_active")
    elif event == "notification":
        rec["message"] = _clip(payload.get("message") or "")
    return rec


def log_event(event: str, check, payload: dict) -> None:
    """Append one line to events.jsonl for this hook invocation. Never raises."""
    try:
        line = json.dumps(_summarise(event, check, payload), ensure_ascii=False)
        with (_session_dir(payload) / "events.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def snapshot_transcript(payload: dict, full: bool = False) -> None:
    """Mirror the live session transcript into the log dir. Never raises.

    Incremental (the Stop path): the transcript is append-only JSONL, so we copy only the bytes
    added since the last snapshot (dst's current size is exactly how much we've already mirrored).
    This keeps each turn's snapshot O(bytes-added) instead of O(filesize) — Stop fires every turn,
    so a full recopy of a multi-MB transcript each time would be O(N²) over a session.

    `full=True` (the SessionEnd path) forces an authoritative full copy. This both handles the
    source shrinking (truncation/rotation) and HEALS any drift the incremental path could have
    introduced if the source were ever rewritten in place mid-session (e.g. compaction rewriting
    earlier bytes) — copy2 replaces dst wholesale, so the final artifact is always byte-exact."""
    try:
        src = payload.get("transcript_path")
        if not src:
            return
        from pathlib import Path

        src_p = Path(src)
        if not src_p.is_file():
            return
        dst = _session_dir(payload) / "transcript.jsonl"
        src_size = src_p.stat().st_size
        copied = dst.stat().st_size if dst.exists() else 0
        if full or src_size < copied:
            shutil.copy2(src_p, dst)  # authoritative full refresh
            return
        if src_size == copied:
            return  # nothing new
        with src_p.open("rb") as s, dst.open("ab") as d:
            s.seek(copied)
            shutil.copyfileobj(s, d)
    except Exception:
        pass


def observe(event: str, check, payload: dict) -> None:
    """Single audit entrypoint for the hook dispatcher: record the event and, at turn/session end,
    refresh the transcript snapshot. Keeps all "what/when to record" policy here rather than in
    hooks.py. Never raises (both callees swallow their own errors)."""
    if not payload:
        return  # e.g. the CLI-only check-anatomy-fresh invocation — no session to audit
    log_event(event, check, payload)
    if event == "stop":
        snapshot_transcript(payload)
    elif event == "session-end":
        snapshot_transcript(payload, full=True)

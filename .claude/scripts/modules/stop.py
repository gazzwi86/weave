"""Stop event: phase-gate HITL ceremony + two-stage context drift detection."""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

from modules.common import _sum_text_chars, _last_messages_excerpt


def phase_gate(payload: dict) -> None:
    """Fire HITL ceremony when all tasks in the current phase are done.

    Reads .claude/state/progress.json to check if phase is complete.
    Only fires if progress.sh phase-check returns COMPLETE.
    The stop_hook_active guard prevents re-entry from /goal's own Stop hook.
    """
    if payload.get("stop_hook_active"):
        return  # guard: /goal or a prior phase_gate invocation triggered this turn

    # Guard: only fire if there are actual tasks in progress.json
    import subprocess
    try:
        state = json.loads(Path(".claude/state/progress.json").read_text(encoding="utf-8"))
        if not state.get("tasks"):
            return  # no tasks exist yet — not a real phase completion
    except (OSError, json.JSONDecodeError, KeyError):
        return  # can't read state; fail silently

    # Check if phase-check indicates completion
    try:
        result = subprocess.run(
            ["bash", ".claude/scripts/progress.sh", "phase-check"],
            capture_output=True, text=True, timeout=10
        )
        # phase-check prints "COMPLETE" or "INCOMPLETE: N remaining" — startswith
        # avoids the substring trap where "COMPLETE" matches inside "INCOMPLETE".
        if result.returncode != 0 or not result.stdout.strip().startswith("COMPLETE"):
            return  # phase not complete; nothing to do
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return  # progress.sh unavailable; fail silently

    # Read kanban summary for the HITL prompt
    try:
        kanban = subprocess.run(
            ["bash", ".claude/scripts/progress.sh", "kanban"],
            capture_output=True, text=True, timeout=10
        ).stdout
    except Exception:
        kanban = "(kanban unavailable)"

    msg = (
        "PHASE COMPLETE — all tasks in the current phase are done.\n"
        "\n"
        "Kanban summary:\n"
        f"{kanban}\n"
        "\n"
        "Run the phase-gate skill to review security findings, mutation scores, "
        "and phase summary before approving the next phase. "
        "Invoke: /phase-gate"
    )
    sys.stderr.write(f"[{msg}]\n")
    sys.exit(2)


def drift_check(payload: dict) -> None:
    """Stop event — two-stage context drift detection.

    Stage 1 (cheap): estimate transcript token usage. Below STOP_HOOK_DRIFT_GATE
    (default 30% of context) return immediately, no local-LLM call.
    Stage 2 (gated): ask the configured local LLM (ollama or lm studio)
    to decide between "nothing", "compact", or "clear". Print verdict to stderr.

    Configuration (set via /setup into settings.local.json):
      LLM_BACKEND           — "ollama" | "lmstudio" (omit to disable)
      LLM_MODEL             — model identifier (e.g. "gemma4:e4b")
      LLM_BASE_URL          — backend HTTP base (defaults per backend)
      LLM_CONTEXT_TOKENS    — local model context window (default 8000)
      CLAUDE_CONTEXT_TOKENS — Claude's context window (default 200000)
      STOP_HOOK_DRIFT_GATE  — pct (0-100) below which LLM is skipped (default 30)

    All failures are silent no-ops — this hook must never block.
    """
    transcript_path = payload.get("transcript_path")

    backend = os.environ.get("LLM_BACKEND", "").strip().lower()
    if backend not in {"ollama", "lmstudio"}:
        return

    if not transcript_path:
        return

    context_max = int(os.environ.get("CLAUDE_CONTEXT_TOKENS", "200000"))
    drift_gate = float(os.environ.get("STOP_HOOK_DRIFT_GATE", "30"))
    if context_max <= 0:
        return

    tokens = _estimate_transcript_tokens(transcript_path)
    if tokens is None:
        return

    usage_pct = (tokens / context_max) * 100
    if usage_pct < drift_gate:
        return

    # Excerpt budget: roughly half the local model's context (in chars), to
    # leave room for the prompt template (~500 tokens) and the response.
    llm_ctx = max(2000, int(os.environ.get("LLM_CONTEXT_TOKENS", "8000")))
    excerpt_chars = max(2000, (llm_ctx - 500) * 4 // 2)

    excerpt = _last_messages_excerpt(transcript_path, max_messages=24, max_chars=excerpt_chars)
    if not excerpt:
        return

    response = _ask_local_llm(backend, _build_drift_prompt(excerpt, usage_pct))
    if response is None:
        return

    verdict = _parse_drift_verdict(response)
    if not verdict or verdict["action"] == "nothing":
        return

    cmd = "/compact" if verdict["action"] == "compact" else "/clear"
    sys.stderr.write(
        f"✨ conversation hygiene: consider {cmd} "
        f"({usage_pct:.0f}% context used) — {verdict['reason']}\n"
    )


def _estimate_transcript_tokens(path: str) -> Optional[int]:
    """Approx token count from a JSONL transcript: chars/4 over message text."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError:
        return None

    chars = 0
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        chars += _sum_text_chars(event)

    return chars // 4 if chars else 0


def _build_drift_prompt(excerpt: str, usage_pct: float) -> str:
    return (
        "You advise on conversation hygiene for a Claude Code coding session. "
        "Given the recent transcript excerpt and current token-usage percentage, "
        "decide ONE of:\n"
        '  - "nothing": continue as-is.\n'
        '  - "compact": context is filling up but the topic is consistent — compress earlier turns.\n'
        '  - "clear": the user has clearly moved to a new task/subject — start fresh.\n\n'
        "Respond with JSON ONLY, no prose:\n"
        '  {"action":"nothing"|"compact"|"clear","reason":"<one short sentence>"}\n\n'
        f"Token usage: {usage_pct:.0f}% of context window.\n\n"
        "Recent transcript:\n"
        f"{excerpt}\n\n"
        "JSON:"
    )


def _parse_drift_verdict(text: str) -> Optional[dict]:
    """Extract the first JSON object with an 'action' field from raw model output."""
    if not text:
        return None
    match = re.search(r"\{[^{}]*\"action\"[^{}]*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        verdict = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    action = verdict.get("action")
    if action not in {"nothing", "compact", "clear"}:
        return None
    return {"action": action, "reason": str(verdict.get("reason", "")).strip()}


def _ask_local_llm(backend: str, prompt: str) -> Optional[str]:
    """POST to a local LLM (ollama or lm studio). Returns response text or None."""
    import urllib.error
    import urllib.request

    model = os.environ.get("LLM_MODEL", "").strip()
    if not model:
        return None

    base = os.environ.get("LLM_BASE_URL", "").rstrip("/")

    if backend == "ollama":
        if not base:
            base = "http://localhost:11434"
        url = f"{base}/api/generate"
        body = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
        text_field = "response"
    elif backend == "lmstudio":
        if not base:
            base = "http://localhost:1234/v1"
        url = f"{base}/chat/completions"
        body = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }).encode("utf-8")
        text_field = None  # extracted via choices[0].message.content below
    else:
        return None

    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, json.JSONDecodeError, TimeoutError):
        return None

    if text_field:
        return data.get(text_field)
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return None

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

    Stage 1 (cheap): read occupied context tokens from the last assistant
    `usage` block (chars/4 estimate as fallback) and divide by the resolved
    context window. Below STOP_HOOK_DRIFT_GATE (default 30%) return immediately,
    no local-LLM call.
    Stage 2 (gated): ask the configured local LLM (ollama or lm studio)
    to decide between "nothing", "compact", or "clear". Print verdict to stderr.

    Configuration (set via /setup into settings.local.json):
      LLM_BACKEND           — "ollama" | "lmstudio" (omit to disable)
      LLM_MODEL             — model identifier (e.g. "batiai/qwen3.6-27b:iq3")
      LLM_BASE_URL          — backend HTTP base (defaults per backend)
      LLM_CONTEXT_TOKENS    — local model context window (default 8000)
      CLAUDE_CONTEXT_WINDOW — override for Claude's context window (tokens); wins
                              over the model-ID registry (see _resolve_context_window)
      CLAUDE_CONTEXT_TOKENS — legacy alias for the above, kept as a fallback
      STOP_HOOK_DRIFT_GATE  — pct (0-100) below which LLM is skipped (default 30)

    All failures are silent no-ops — this hook must never block.
    """
    transcript_path = payload.get("transcript_path")

    backend = os.environ.get("LLM_BACKEND", "").strip().lower()
    if backend not in {"ollama", "lmstudio"}:
        return

    if not transcript_path:
        return

    context_max = _resolve_context_window(payload, transcript_path)
    drift_gate = float(os.environ.get("STOP_HOOK_DRIFT_GATE", "30"))
    if context_max <= 0:
        return

    # Prefer the real occupied-context figure from the last assistant `usage`
    # block; fall back to the chars/4 estimate only when usage is unavailable.
    tokens = _tokens_from_last_usage(transcript_path)
    if tokens is None:
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

    response = _ask_local_llm(backend, _build_drift_prompt(excerpt, usage_pct, context_max))
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


def _build_drift_prompt(excerpt: str, usage_pct: float, context_window: int) -> str:
    return (
        "You advise on conversation hygiene for a Claude Code coding session. "
        "Given the recent transcript excerpt and current token-usage percentage, "
        "decide ONE of:\n"
        '  - "nothing": continue as-is.\n'
        '  - "compact": context is filling up but the topic is consistent — compress earlier turns.\n'
        '  - "clear": the user has clearly moved to a new task/subject — start fresh.\n\n'
        "Respond with JSON ONLY, no prose:\n"
        '  {"action":"nothing"|"compact"|"clear","reason":"<one short sentence>"}\n\n'
        f"Token usage: {usage_pct:.0f}% of a {context_window:,}-token context window.\n\n"
        "Recent transcript:\n"
        f"{excerpt}\n\n"
        "JSON:"
    )


# Context-window registry. Each entry is a (case-insensitive substring marker,
# window) pair matched against the model ID; the first hit wins. Only variants
# that DIFFER from the 200k default need an entry — the 1M-context variants. Every
# current base-tier model and any future 200k model falls through to the default.
#
# LIMITATION: transcript `model` fields arrive WITHOUT the `[1m]` suffix even on a
# 1M-context session (verified: a claude-opus-4-8[1m] session logs a bare
# "claude-opus-4-8"), so a 1M session is resolved from data only if the ID happens
# to carry a marker — otherwise the CLAUDE_CONTEXT_WINDOW override is the reliable
# path. Add markers here as new context tiers ship.
_CONTEXT_WINDOW_DEFAULT = 200_000
_CONTEXT_WINDOW_MARKERS = (
    ("[1m]", 1_000_000),
    ("-1m", 1_000_000),
)


def _window_for_model(model_id: str) -> Optional[int]:
    """Resolve a model ID to a context window when the registry positively
    recognises a non-default tier (e.g. a 1M variant); otherwise None so the
    caller falls back to the legacy env var or the default."""
    if not model_id:
        return None
    mid = model_id.strip().lower()
    for marker, window in _CONTEXT_WINDOW_MARKERS:
        if marker in mid:
            return window
    return None


def _resolve_context_window(payload: dict, transcript_path: Optional[str]) -> int:
    """Determine the active model's context window in tokens.

    Priority:
      1. CLAUDE_CONTEXT_WINDOW env override (explicit, wins over everything).
      2. Model-ID registry — model from the Stop payload, else the last
         transcript message (only recognised non-default tiers resolve here).
      3. CLAUDE_CONTEXT_TOKENS legacy env (back-compat for existing setups).
      4. _CONTEXT_WINDOW_DEFAULT (200k).
    """
    override = _positive_int(os.environ.get("CLAUDE_CONTEXT_WINDOW"))
    if override:
        return override

    model_id = str(payload.get("model") or "").strip()
    if not model_id and transcript_path:
        model_id = _model_from_transcript(transcript_path) or ""
    window = _window_for_model(model_id)
    if window:
        return window

    legacy = _positive_int(os.environ.get("CLAUDE_CONTEXT_TOKENS"))
    if legacy:
        return legacy

    return _CONTEXT_WINDOW_DEFAULT


def _positive_int(raw: Optional[str]) -> Optional[int]:
    """Parse a positive int from an env-var string, or None."""
    if not raw:
        return None
    try:
        val = int(raw.strip())
    except ValueError:
        return None
    return val if val > 0 else None


def _model_from_transcript(path: str) -> Optional[str]:
    """Model ID from the most recent transcript message carrying one, or None.
    Scans from the end so the currently-active model wins."""
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = event.get("message")
        model = event.get("model") or (msg.get("model") if isinstance(msg, dict) else None)
        if model:
            return str(model)
    return None


def _tokens_from_last_usage(path: str) -> Optional[int]:
    """Occupied context tokens from the most recent assistant `usage` block:
    input + cache_read + cache_creation. This is the real context footprint at
    that turn — more accurate than the chars/4 estimate. None if no usage found."""
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = event.get("message")
        usage = msg.get("usage") if isinstance(msg, dict) else event.get("usage")
        if isinstance(usage, dict):
            total = (
                (usage.get("input_tokens") or 0)
                + (usage.get("cache_read_input_tokens") or 0)
                + (usage.get("cache_creation_input_tokens") or 0)
            )
            if total > 0:
                return total
    return None


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
    import urllib.parse
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

    if urllib.parse.urlsplit(url).scheme not in ("http", "https"):
        return None

    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        # scheme restricted to http/https above, closing the file:// vector this rule audits for.
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, json.JSONDecodeError, TimeoutError):
        return None

    if text_field:
        return data.get(text_field)
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return None

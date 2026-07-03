"""Usage-limit detection (ADR-H1/H4 reopen, 2026-07-02).

StopFailure fires when a turn dies on an API failure (matcher in settings.json:
rate_limit|billing_error). The hook contract is observe-only — output and exit
code are ignored — so this handler only leaves evidence: a flag file that
run-loop.sh polls to decide fallback/sleep, plus a best-effort desktop ping
for supervised sessions.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from modules.common import PROJECT_ROOT

LIMIT_FLAG = PROJECT_ROOT / ".claude" / "state" / "limit-hit"

# "resets 11:20pm (Australia/Melbourne)" — the shape Claude's session-limit error uses.
_RESET_RE = re.compile(
    r"resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([^)]+)\)", re.IGNORECASE
)


def parse_resets_at(text: str, now: datetime | None = None) -> str | None:
    """Extract the window-reset wall time from a limit message → UTC ISO, else None.

    The message gives clock time only, so we take the NEXT occurrence of that
    time in the named zone (today if still ahead, else tomorrow).
    """
    m = _RESET_RE.search(text)
    if not m:
        return None
    hour, minute, ampm, zone_name = (
        int(m.group(1)),
        int(m.group(2) or 0),
        m.group(3).lower(),
        m.group(4).strip(),
    )
    if not 1 <= hour <= 12 or not 0 <= minute <= 59:
        return None
    hour = hour % 12 + (12 if ampm == "pm" else 0)
    try:
        tz = ZoneInfo(zone_name)
    except Exception:
        return None
    now_tz = (now or datetime.now(timezone.utc)).astimezone(tz)
    candidate = now_tz.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now_tz:
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc).isoformat(timespec="seconds")


def stop_failure(payload: dict) -> None:
    reason = str(
        payload.get("reason")
        or payload.get("message")
        or payload.get("error")
        or payload.get("last_assistant_message")
        or "unknown"
    )
    record: dict[str, str] = {
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "reason": reason,
    }
    resets_at = parse_resets_at(reason)
    if resets_at:
        record["resets_at"] = resets_at
    try:
        LIMIT_FLAG.parent.mkdir(parents=True, exist_ok=True)
        LIMIT_FLAG.write_text(json.dumps(record) + "\n", encoding="utf-8")
    except OSError:
        pass
    sys.stderr.write(f"limits: API failure recorded ({reason})\n")
    _notify(f"Usage limit / billing failure: {reason}")


def _notify(message: str) -> None:
    if os.environ.get("WEAVE_NO_NOTIFY"):
        return
    safe = re.sub(r'["\\\n]', " ", message)[:200]
    try:
        subprocess.run(
            ["osascript", "-e", f'display notification "{safe}" with title "Weave harness"'],
            capture_output=True,
            timeout=5,
        )
    except Exception:
        pass

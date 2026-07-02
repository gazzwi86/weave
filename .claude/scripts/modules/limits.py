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
from datetime import datetime, timezone

from modules.common import PROJECT_ROOT

LIMIT_FLAG = PROJECT_ROOT / ".claude" / "state" / "limit-hit"


def stop_failure(payload: dict) -> None:
    reason = str(payload.get("reason") or payload.get("message") or "unknown")
    try:
        LIMIT_FLAG.parent.mkdir(parents=True, exist_ok=True)
        LIMIT_FLAG.write_text(
            json.dumps(
                {
                    "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "reason": reason,
                }
            )
            + "\n",
            encoding="utf-8",
        )
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

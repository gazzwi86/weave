"""CI mutation-score gate (AC-3: mutation score check >= 70%).

Reads mutmut's `export-cicd-stats` JSON output and decides pass/fail. If
there are no mutants at all (`total == 0` — an early-stage codebase with
nothing yet to mutate), the gate passes structurally rather than
false-failing on a 0/0 division. But if mutants exist and none were killed
or survived (`total > 0`, `killed + survived == 0`), that is indistinguishable
from "nothing to mutate" by count alone but really means the run was
interrupted or timed out — so the gate fails loudly instead of passing
silently.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

DEFAULT_THRESHOLD = 70.0


def evaluate(
    stats: dict[str, int], threshold: float = DEFAULT_THRESHOLD
) -> tuple[float | None, bool]:
    """Return (score_percent_or_none, passed) for a mutmut cicd-stats dict."""
    if stats.get("total", 0) == 0:
        return None, True
    checked = stats.get("killed", 0) + stats.get("survived", 0)
    if checked == 0:
        return None, False
    score = stats.get("killed", 0) / checked * 100
    return score, score >= threshold


def main(stats_path: str) -> int:
    """Load a mutmut cicd-stats JSON file and return a CI exit code (0 pass, 1 fail)."""
    stats = json.loads(Path(stats_path).read_text())
    score, passed = evaluate(stats)
    if score is not None:
        print(f"mutation score: {score:.1f}% (threshold {DEFAULT_THRESHOLD:.0f}%)")
    elif passed:
        print("mutation gate: no mutants to exercise yet — passing structurally")
    else:
        print(
            f"mutation gate: FAIL — {stats.get('total', 0)} mutants exist but "
            "0 were killed or survived (run likely interrupted or timed out)"
        )
    return 0 if passed else 1


if __name__ == "__main__":
    default_path = "mutants/mutmut-cicd-stats.json"
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else default_path))

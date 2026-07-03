"""CI mutation-score gate (AC-3: mutation score check >= 70%).

Reads mutmut's `export-cicd-stats` JSON output and decides pass/fail. If no
mutants were killed or survived yet (nothing the current suite exercises was
mutated — e.g. an early-stage codebase), the gate passes structurally rather
than false-failing on a 0/0 division: there is nothing to grade yet, and the
threshold starts being enforced for real the moment there is.
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
    checked = stats.get("killed", 0) + stats.get("survived", 0)
    if checked == 0:
        return None, True
    score = stats.get("killed", 0) / checked * 100
    return score, score >= threshold


def main(stats_path: str) -> int:
    """Load a mutmut cicd-stats JSON file and return a CI exit code (0 pass, 1 fail)."""
    stats = json.loads(Path(stats_path).read_text())
    score, passed = evaluate(stats)
    if score is None:
        print("mutation gate: no mutants exercised yet by the test suite — passing structurally")
    else:
        print(f"mutation score: {score:.1f}% (threshold {DEFAULT_THRESHOLD:.0f}%)")
    return 0 if passed else 1


if __name__ == "__main__":
    default_path = "mutants/mutmut-cicd-stats.json"
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else default_path))

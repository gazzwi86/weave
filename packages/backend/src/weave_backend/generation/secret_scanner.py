"""BE-TASK-008 gate 1 (secret-scan, AC-4): regex scan of a generated
workspace for plaintext secrets. Patterns live in `secret_patterns.json`
(Implementation Hints) -- not hardcoded here -- so the shapes covered can be
extended without touching this module.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_PATTERNS_PATH = Path(__file__).parent / "secret_patterns.json"


def _load_patterns() -> list[re.Pattern[str]]:
    raw = json.loads(_PATTERNS_PATH.read_text())["patterns"]
    return [re.compile(pattern, re.IGNORECASE) for pattern in raw]


def scan_for_secrets(workspace: str) -> list[dict[str, object]]:
    """AC-4: every match's file path (relative to `workspace`) and 1-based
    line number, so a failure response can point straight at the offending
    line. Non-UTF8/unreadable files are skipped, not fatal.
    """
    root = Path(workspace)
    patterns = _load_patterns()
    hits: list[dict[str, object]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            for pattern in patterns:
                if pattern.search(line):
                    hits.append(
                        {
                            "file": str(path.relative_to(root)),
                            "line": lineno,
                            "pattern": pattern.pattern,
                        }
                    )
    return hits

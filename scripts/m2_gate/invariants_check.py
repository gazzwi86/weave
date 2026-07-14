#!/usr/bin/env python3
"""CE-V1-TASK-030 AC-5: the M2 invariants runner.

Reads `docs/specs/weave/engines/constitution-engine/tech-spec/invariants-explorer.md`,
extracts each `verify-by:` clause's backtick-quoted tokens, and executes them:
  - a `test_*` token: PASS if defined anywhere under packages/*/tests or
    packages/frontend's __tests__ dirs (grep -r "test_name\(" / "\"test_name\"").
  - a repo-relative path token (contains "/" or a file extension): PASS if
    the file exists; a following quoted grep pattern (word "grep" precedes
    it) then greps that file/dir, inverted by "(must be empty)"/"outside"
    wording in the surrounding line.

# ponytail: markdown-parse by regex, not a structured format -- upgrade to a
# real schema (YAML frontmatter per invariant) if the list grows past ~40
# lines and the regex starts missing real failures.

Exit 0 = every invariant resolved; exit 1 = at least one unmet invariant.
Writes a JSON result to stdout (or --out <path>) for the gate bundle.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
INVARIANTS_MD = (
    REPO_ROOT
    / "docs/specs/weave/engines/constitution-engine/tech-spec/invariants-explorer.md"
)
_TEST_NAME = re.compile(r"`(test_[a-zA-Z0-9_]+)`")
_PATH_TOKEN = re.compile(r"`([\w./-]+\.(?:py|ts|tsx|sql|yml|yaml))`")
_GREP_PATTERN = re.compile(r"grep(?:\s+-\w+)*\s+\"([^\"]+)\"")


def _test_defined(name: str) -> bool:
    result = subprocess.run(
        [
            "grep",
            "-rlE",
            "--exclude-dir=node_modules",
            "--exclude-dir=.next",
            rf'(def {name}\(|"{name}"|\x27{name}\x27)',
            "packages",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    return bool(result.stdout.strip())


def _grep_hits(path: str, pattern: str) -> int:
    target = REPO_ROOT / path
    if not target.exists():
        return 0
    result = subprocess.run(
        ["grep", "-r", pattern, str(target)], capture_output=True, text=True
    )
    return len(result.stdout.splitlines())


def _check_line(line: str) -> dict[str, object]:
    paths = _PATH_TOKEN.findall(line)
    tests = _TEST_NAME.findall(line)
    patterns = _GREP_PATTERN.findall(line)
    must_be_empty = "must be empty" in line or "must be absent" in line

    findings: list[str] = []
    ok = True
    for path in paths:
        if not (REPO_ROOT / path).exists():
            ok = False
            findings.append(f"missing path: {path}")
    for name in tests:
        if not _test_defined(name):
            ok = False
            findings.append(f"missing test: {name}")
    for pattern in patterns:
        hits = sum(_grep_hits(p, pattern) for p in paths) if paths else 0
        if must_be_empty and hits > 0:
            ok = False
            findings.append(f"pattern '{pattern}' should be absent, found {hits} hit(s)")
        elif not must_be_empty and paths and hits == 0:
            ok = False
            findings.append(f"pattern '{pattern}' not found in {paths}")

    return {"ok": ok, "findings": findings, "paths": paths, "tests": tests}


def _bullets(text: str) -> list[str]:
    """Bullets in this doc wrap across physical lines (prose paragraph
    style, not one-line-per-bullet) -- join continuation lines back onto
    their `- ` bullet before scanning, or a `verify-by:`/backtick token that
    lands on the wrapped line is invisible to the per-line checker.
    """
    joined: list[str] = []
    for raw_line in text.splitlines():
        if raw_line.startswith("- "):
            joined.append(raw_line)
        elif raw_line.startswith("  ") and joined:
            joined[-1] += " " + raw_line.strip()
    return joined


def run() -> dict[str, object]:
    text = INVARIANTS_MD.read_text()
    results = []
    for bullet in _bullets(text):
        if "verify-by:" not in bullet:
            continue
        outcome = _check_line(bullet)
        results.append({"line": bullet.strip(), **outcome})
    return {
        "total": len(results),
        "passed": sum(1 for r in results if r["ok"]),
        "failed": [r for r in results if not r["ok"]],
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    report = run()
    payload = json.dumps(report, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload)
    print(payload)
    return 0 if not report["failed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

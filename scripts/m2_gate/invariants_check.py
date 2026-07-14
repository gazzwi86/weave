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
_GREP_PATTERN_QUOTED = re.compile(r"grep((?:\s+-\w+)*)\s+\"([^\"]+)\"")
# `grep word` with no quotes at all (e.g. `` `grep principal_iri` ``).
_GREP_PATTERN_BARE = re.compile(r"`grep((?:\s+-\w+)*)\s+([A-Za-z_][\w.]*)`")
_PROSE_TEST = re.compile(r"conformance test\s+`([^`]+)`")
# Default scan root for a `verify-by:` pattern that names no explicit path
# (e.g. "grep -r \"amazonaws.com\" in test code") -- whole source tree,
# excluding build/dep noise and the gate's own generated evidence.
_DEFAULT_SCAN_EXCLUDES = ["node_modules", ".next", "dist", "build", "artefacts", ".venv"]
_EXCLUDE_ARGS = [f"--exclude-dir={d}" for d in _DEFAULT_SCAN_EXCLUDES]


def _test_defined(name: str) -> bool:
    result = subprocess.run(
        ["grep", "-rlE", *_EXCLUDE_ARGS, rf'(def {name}\(|"{name}"|\x27{name}\x27)', "packages"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    return bool(result.stdout.strip())


def _test_defined_literal(name: str) -> bool:
    """A prose conformance-test title (not a `test_*` symbol) -- verified as
    a literal fixed-string hit rather than a name-shaped regex."""
    result = subprocess.run(
        ["grep", "-rlF", *_EXCLUDE_ARGS, name, "packages"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    return bool(result.stdout.strip())


def _grep_flag(flags: str) -> str:
    """`-r` always; add `-E` only when the spec bullet itself asked for it
    (e.g. `` `grep -riE "..."` ``) -- blanket `-E` breaks patterns that rely
    on literal parens (e.g. `set_config('app.current_tenant_id'`), so this
    must be per-bullet, not global."""
    return "-rE" if "E" in flags else "-r"


def _grep_hits(paths: list[str], pattern: str, flags: str = "") -> int:
    """Hit count for `pattern` across `paths` (files/dirs), or the whole
    `packages` tree when `paths` is empty -- a `verify-by:` grep with no
    explicit path token still has to run *somewhere*, never silently skip
    (that was the AC-5 gate hole: hits defaulted to 0 and never failed)."""
    targets = [str(REPO_ROOT / p) for p in paths] if paths else [str(REPO_ROOT / "packages")]
    cmd = ["grep", _grep_flag(flags), *_EXCLUDE_ARGS, pattern, *targets]
    result = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
    return len(result.stdout.splitlines())


def _grep_hits_excluding(pattern: str, exclude_path: str, flags: str = "") -> int:
    """Repo-wide (`packages`) hit count for `pattern`, minus any hit inside
    `exclude_path` -- the "X outside `path`" verify-by shape."""
    result = subprocess.run(
        ["grep", _grep_flag(flags), *_EXCLUDE_ARGS, pattern, "packages"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    lines = result.stdout.splitlines()
    return len([hit for hit in lines if exclude_path not in hit.split(":", 1)[0]])


def _check_names(paths: list[str], tests: list[str], prose_tests: list[str]) -> list[str]:
    """Existence checks for path/test/conformance-test tokens. Returns findings."""
    findings: list[str] = []
    for path in paths:
        if not (REPO_ROOT / path).exists():
            findings.append(f"missing path: {path}")
    for name in tests:
        if not _test_defined(name):
            findings.append(f"missing test: {name}")
    for name in prose_tests:
        if not _test_defined_literal(name):
            findings.append(f"missing conformance test: {name}")
    return findings


def _check_pattern(
    pattern: str, paths: list[str], line: str, outside_path: str | None, flags: str = ""
) -> list[str]:
    """One grep-pattern check, in whichever of the three verify-by shapes
    the bullet uses (plain / "outside `path`" / "... in each")."""
    must_be_empty = "must be empty" in line or "must be absent" in line
    if outside_path:
        hits = _grep_hits_excluding(pattern, outside_path, flags)
        if must_be_empty and hits > 0:
            return [f"pattern '{pattern}' should be absent outside {outside_path}: {hits} hit(s)"]
        return []
    if "in each" in line and paths:
        return [
            f"pattern '{pattern}' not found in {path} (required in each)"
            for path in paths
            if _grep_hits([path], pattern, flags) == 0
        ]
    hits = _grep_hits(paths, pattern, flags)
    if must_be_empty and hits > 0:
        return [f"pattern '{pattern}' should be absent, found {hits} hit(s)"]
    if not must_be_empty and hits == 0:
        return [f"pattern '{pattern}' not found in {paths or ['packages/**']}"]
    return []


def _check_line(line: str) -> dict[str, object]:
    paths = _PATH_TOKEN.findall(line)
    tests = _TEST_NAME.findall(line)
    prose_tests = _PROSE_TEST.findall(line)
    pattern_matches = _GREP_PATTERN_QUOTED.findall(line) + _GREP_PATTERN_BARE.findall(line)
    outside_match = re.search(r"outside\s+`([^`]+)`", line)
    outside_path = outside_match.group(1) if outside_match else None

    findings = _check_names(paths, tests, prose_tests)
    for flags, pattern in pattern_matches:
        findings += _check_pattern(pattern, paths, line, outside_path, flags)

    if not (paths or tests or prose_tests or pattern_matches):
        findings.append("unparseable invariant -- no check executed (fail-closed)")

    return {"ok": not findings, "findings": findings, "paths": paths, "tests": tests + prose_tests}


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

"""Regression test for git_safety.check_force_push (force-with-lease policy).

Runnable standalone: `python3 .claude/scripts/tests/test_git_safety_force.py`
(no pytest needed). Guards the security-sensitive rule that permits
`--force-with-lease` on feature branches while refusing bare `--force`/`-f`
everywhere and any force-push at main/master.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules import git_safety as g  # noqa: E402


class _Blocked(Exception):
    pass


g.block = lambda msg: (_ for _ in ()).throw(_Blocked(msg))  # type: ignore[assignment]


def _verdict(cmd: str) -> str:
    try:
        g.check_force_push({"tool_name": "Bash", "tool_input": {"command": cmd}})
        return "ALLOW"
    except _Blocked:
        return "BLOCK"


CASES = {
    # feature-branch restack — the whole point of the policy
    "git push --force-with-lease": "ALLOW",
    "git push --force-with-lease origin feature/PLAT-EPIC-003": "ALLOW",
    # bare force is refused everywhere
    "git push --force": "BLOCK",
    "git push -f": "BLOCK",
    "git push -fv origin feature/y": "BLOCK",
    # force at a protected branch is refused even with lease
    "git push --force-with-lease origin main": "BLOCK",
    "git push --force-with-lease origin master": "BLOCK",
    # ordinary pushes are untouched
    "git push origin main": "ALLOW",
    "git push": "ALLOW",
    # a --force mentioned only inside a quoted message is not the real flag
    'git commit -m "ban --force" && git push origin feature/x': "ALLOW",
}


def main() -> int:
    failures = [
        (cmd, exp, got)
        for cmd, exp in CASES.items()
        if (got := _verdict(cmd)) != exp
    ]
    for cmd, exp, got in failures:
        print(f"MISMATCH: {cmd!r} expected {exp}, got {got}")
    if failures:
        print(f"{len(failures)} failure(s)")
        return 1
    print(f"all {len(CASES)} force-push policy cases pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

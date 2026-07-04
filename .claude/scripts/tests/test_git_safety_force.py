"""Regression test for git_safety.check_force_push (force-with-lease policy).

Runnable standalone: `python3 .claude/scripts/tests/test_git_safety_force.py`
(no pytest needed). Guards the security-sensitive rule that permits
`--force-with-lease` on feature branches while refusing every unconditional
force (`--force`/`-f`/`+refspec`) and any force-push at main/master.

This hook is the SOLE enforcement (no server-side branch protection), so the
cases below deliberately include the bypass classes an adversary would try.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules import git_safety as g  # noqa: E402


class _Blocked(Exception):
    pass


g.block = lambda msg: (_ for _ in ()).throw(_Blocked(msg))  # type: ignore[assignment]


def _verdict(cmd: str, *, head_protected: bool = False) -> str:
    """head_protected simulates `git branch --show-current` returning main/master,
    so the no-refspec cases are deterministic regardless of the real branch."""
    g._pushes_protected_head = lambda: head_protected  # type: ignore[assignment]
    try:
        g.check_force_push({"tool_name": "Bash", "tool_input": {"command": cmd}})
        return "ALLOW"
    except _Blocked:
        return "BLOCK"


# (command, expected, head_protected)
CASES = [
    # feature-branch restack — the whole point of the policy
    ("git push --force-with-lease", "ALLOW", False),
    ("git push --force-with-lease origin feature/PLAT-EPIC-003", "ALLOW", False),
    ("git push --force-with-lease origin feature/main-nav", "ALLOW", False),  # hyphen, not `main`
    # unconditional force is refused everywhere
    ("git push --force", "BLOCK", False),
    ("git push -f", "BLOCK", False),
    ("git push -fv origin feature/y", "BLOCK", False),
    ("git push origin +main", "BLOCK", False),          # +refspec force syntax
    ("git push origin +feature/x", "BLOCK", False),     # +refspec, any branch
    ('git push "--force" origin main', "BLOCK", False),  # quoted flag the shell unquotes
    # force at a protected branch is refused even with lease
    ("git push --force-with-lease origin main", "BLOCK", False),
    ("git push --force-with-lease origin master", "BLOCK", False),
    # --force-with-lease with no refspec pushes HEAD → depends on current branch
    ("git push --force-with-lease", "BLOCK", True),      # HEAD is main
    ("git push --force-with-lease origin", "BLOCK", True),  # remote only, still HEAD
    # a -f in a NEIGHBOURING command is not a push force flag
    ("rm -f /tmp/x && git push origin feature/y", "ALLOW", False),
    ("tar -xf a.tar && git push origin feature/z", "ALLOW", False),
    # ordinary pushes are untouched
    ("git push origin main", "ALLOW", False),
    ("git push", "ALLOW", False),
    # a --force mentioned only inside a quoted commit message is not a push flag
    ('git commit -m "ban --force" && git push origin feature/x', "ALLOW", False),
]


def main() -> int:
    failures = [
        (cmd, exp, got)
        for cmd, exp, hp in CASES
        if (got := _verdict(cmd, head_protected=hp)) != exp
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

"""ONB-V1-TASK-005 AC-005-06: the invariants.md §M2 selector-check.

Parses `verify-by:` clauses out of the onboarding engine's
`tech-spec/invariants.md` §M2 section and proves each one still resolves
against the real tree: the named file exists and its stated grep pattern is
found inside it.

`invariants.md`'s own header warns its `apps/` / `packages/` paths are
"planned code locations... QA re-anchors selectors if layout moves" -- and
this repo's actual M2 layout *has* moved from the spec's aspirational paths
(`apps/api/tests/onboarding/*.py` -> `packages/backend/tests/**/test_onboarding_*.py`;
`e2e/onboarding/*.spec.ts` -> `packages/frontend/tests/e2e/*.spec.ts`;
`scripts/tour-anchor-audit` -> `packages/shared/onboarding/scripts/audit-anchors.ts`).
So resolution falls back from an exact path to a basename search under
`packages/` before giving up -- an honest re-anchor, not a loosened check
(a hit still requires the *same* filename and the *same* grep pattern).

# ponytail: hand-rolled markdown parse (line-oriented, `verify-by:` prefix +
# backtick tokens) rather than a shared parser -- mirrors the sibling
# CE-V1-TASK-030 `scripts/m2_gate/invariants_check.py` (read-only reference
# for this task); promote to a shared script if a third engine needs the
# same shape.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

import pytest


def _find_repo_root(start: Path) -> Path:
    """Walk up from `start` to the repo-root marker.

    # ponytail: a fixed `parents[N]` index breaks under mutmut, which copies
    # the test tree into a `mutants/` subdirectory -- shifting every ancestor
    # one level, landing `parents[N]` on the wrong directory. Walking up to a
    # marker (`.git`) tolerates the extra path segment regardless of depth.
    """
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    raise RuntimeError(f"no repo root found walking up {start}")


_REPO_ROOT = _find_repo_root(Path(__file__).resolve())
_INVARIANTS_MD = (
    _REPO_ROOT / "docs/specs/weave/engines/onboarding/tech-spec/invariants.md"
)
_PACKAGES = _REPO_ROOT / "packages"

_VERIFY_BY_LINE = re.compile(r"verify-by:\s*`([^`]+)`\s*\+\s*grep\s*`([^`]+)`")

#: Stated (spec) path -> real path, for the handful of M2 selectors whose
#: basename itself changed (not just its directory), so the basename
#: fallback in `_resolve_file` can't find them: `tour-anchor-audit` became
#: `checks/audit.ts` (the module that actually carries the `shipped` logic;
#: `scripts/audit-anchors.ts` is its CLI wrapper) when TASK-001 split the
#: audit into a testable pure module + a thin runner, and this task's own
#: new competency-guidance test file kept the sibling `test_onboarding_*`
#: naming convention (matching test_onboarding_router.py etc.) rather than
#: the spec's unprefixed `test_competency_guidance.py`.
_KNOWN_RENAMES: dict[str, str] = {
    "scripts/tour-anchor-audit": "packages/shared/onboarding/checks/audit.ts",
    "apps/api/tests/onboarding/test_competency_guidance.py": (
        "packages/backend/tests/unit/test_onboarding_competency_guidance.py"
    ),
}


def _m2_section_lines() -> list[str]:
    text = _INVARIANTS_MD.read_text()
    m2_section = text.split("## M2", 1)[1]
    return [line for line in m2_section.splitlines() if "verify-by:" in line]


def _resolve_file(stated_path: str) -> Path | None:
    literal = _REPO_ROOT / stated_path
    if literal.is_file():
        return literal
    if stated_path in _KNOWN_RENAMES:
        renamed = _REPO_ROOT / _KNOWN_RENAMES[stated_path]
        return renamed if renamed.is_file() else None
    basename = Path(stated_path).name
    hits = list(_PACKAGES.rglob(basename))
    hits = [h for h in hits if "node_modules" not in h.parts and ".next" not in h.parts]
    return hits[0] if len(hits) == 1 else None


def _pattern_hits(path: Path, pattern: str) -> bool:
    result = subprocess.run(
        ["grep", "-r", "-E", pattern, str(path)],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    # ponytail: parametrize via this hook (not a module-level
    # `@pytest.mark.parametrize("x", _m2_section_lines())`) so a path/read
    # failure surfaces as one failing test, never a collection error that
    # would nuke the whole module (and with it, mutmut's baseline run).
    if "verify_by_line" in metafunc.fixturenames:
        try:
            lines = _m2_section_lines()
        except OSError as exc:
            lines = [f"__read_failed__:{exc}"]
        metafunc.parametrize("verify_by_line", lines)


def test_m2_invariant_selector_resolves(verify_by_line: str) -> None:
    match = _VERIFY_BY_LINE.search(verify_by_line)
    assert match, f"line doesn't match the verify-by shape: {verify_by_line!r}"
    stated_path, pattern = match.groups()

    resolved = _resolve_file(stated_path)
    assert resolved is not None, (
        f"no file resolves for stated path {stated_path!r} "
        f"(checked literal path and a unique basename match under packages/)"
    )
    assert _pattern_hits(resolved, pattern), (
        f"pattern {pattern!r} not found in resolved file {resolved} (stated: {stated_path!r})"
    )


def test_m2_section_has_entries() -> None:
    """The gate isn't vacuously true -- the §M2 section must actually parse
    at least one `verify-by:` line."""
    assert len(_m2_section_lines()) >= 5

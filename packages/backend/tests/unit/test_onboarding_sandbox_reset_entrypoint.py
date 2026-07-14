"""ONB-TASK-005 AC-005-05: reset must never auto-fire -- the only caller of
`sandbox.build_reset_workspace` / `store.swap_sandbox_pointer` anywhere in the
backend source tree is the `/api/onboarding/sandbox/reset` route itself. No
timer, scheduler, or navigation handler may reference either symbol.
"""

from __future__ import annotations

from pathlib import Path

_SRC_ROOT = Path(__file__).resolve().parents[2] / "src" / "weave_backend"
_ALLOWED_CALLERS = {"routers/onboarding.py"}
_GUARDED_SYMBOLS = ("build_reset_workspace(", "swap_sandbox_pointer(")


def _relative_paths_calling(symbol: str) -> set[str]:
    hits = set()
    for path in _SRC_ROOT.rglob("*.py"):
        text = path.read_text()
        if symbol not in text:
            continue
        rel = str(path.relative_to(_SRC_ROOT))
        # Definitions themselves don't count as "calls".
        if f"def {symbol[:-1]}" in text and text.count(symbol) == text.count(
            f"def {symbol[:-1]}"
        ):
            continue
        hits.add(rel)
    return hits


def test_no_non_route_code_path_calls_reset() -> None:
    for symbol in _GUARDED_SYMBOLS:
        callers = _relative_paths_calling(symbol)
        # The defining module (sandbox.py / store.py) legitimately contains
        # the `def` line -- only routers/onboarding.py may *call* it.
        callers -= {"onboarding/sandbox.py", "onboarding/store.py"}
        assert callers <= _ALLOWED_CALLERS, (
            f"unexpected caller(s) of {symbol!r}: {callers - _ALLOWED_CALLERS}"
        )

"""PostToolUse: circular dependency check — disabled pending ESM port."""

import re
from pathlib import Path
from typing import Optional

_REQUIRE_RE = re.compile(r"""\brequire\s*\(\s*["']([^"']+)["']\s*\)""")
_BLOCK_COMMENT = re.compile(r"/\*[\s\S]*?\*/")
_LINE_COMMENT = re.compile(r"(^|[^:])//.*$", re.MULTILINE)


def _resolve_local(from_file: Path, spec: str) -> Optional[Path]:
    if not (spec.startswith(".") or spec.startswith("/")):
        return None
    base = Path(spec) if spec.startswith("/") else (from_file.parent / spec).resolve()
    for candidate in (base, base.with_suffix(".js"), base / "index.js"):
        if candidate.is_file():
            return candidate.resolve()
    return None


def _extract_requires(file: Path) -> list[str]:
    src = file.read_text(encoding="utf-8")
    stripped = _LINE_COMMENT.sub(r"\1", _BLOCK_COMMENT.sub("", src))
    return _REQUIRE_RE.findall(stripped)


def _find_cycle(start: Path) -> Optional[list[Path]]:
    stack: list[Path] = []
    on_stack: set[Path] = set()
    visited: set[Path] = set()

    def dfs(node: Path) -> Optional[list[Path]]:
        if node in on_stack:
            idx = stack.index(node)
            return stack[idx:] + [node]
        if node in visited:
            return None
        visited.add(node)
        on_stack.add(node)
        stack.append(node)

        try:
            deps = _extract_requires(node)
        except OSError:
            deps = []

        for spec in deps:
            resolved = _resolve_local(node, spec)
            if not resolved:
                continue
            cycle = dfs(resolved)
            if cycle:
                return cycle

        stack.pop()
        on_stack.discard(node)
        return None

    return dfs(start)


def check_circular_deps(_payload: dict) -> None:
    """PostToolUse:Edit|Write — disabled.

    The original DFS walked CommonJS `require()` edges in `src/*.js`. The
    rewrite uses TypeScript + ESM across `apps/`, `packages/` — `_extract_requires`
    no longer applies. Re-enable by shelling to `madge --circular --extensions ts,tsx`
    if a cycle gate is wanted again.
    """
    return

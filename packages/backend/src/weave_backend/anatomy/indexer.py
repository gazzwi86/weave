"""TASK-009 (build-engine EPIC-008) FR-031/AC-1: anatomy/wiki auto-index for
generated repos -- so a delegate agent loads context instead of
re-discovering it (AC-2, `build/orchestrator.py`'s `load_task_context`).
Shallow, language-aware scan (task brief's implementation hint): exported
top-level functions/classes only, no full parse, no docstring extraction.

`refresh_anatomy` is filesystem-only (no DB, no network) so it runs inside
`generate_app`'s staging workspace, before `_commit_workspace` -- the
Design Decisions table calls this out as part of the same atomic commit set
(a scan failure fails the whole run, never a stale-index commit).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

#: Directories never worth indexing -- dependency trees, VCS internals,
#: build caches. (Mirrors `generation/gates.py`'s scanned-suffix allowlist
#: approach: exclude by name, not by trying to enumerate every ignorable.)
_SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "dist", "build", ".next"}

_PY_SYMBOL = re.compile(r"^(?:async\s+)?def\s+(\w+)|^class\s+(\w+)", re.MULTILINE)
_TS_SYMBOL = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?(?:function|class)\s+(\w+)"
    r"|^export\s+const\s+(\w+)",
    re.MULTILINE,
)
_SCANNERS: dict[str, re.Pattern[str]] = {
    ".py": _PY_SYMBOL,
    ".ts": _TS_SYMBOL,
    ".tsx": _TS_SYMBOL,
}


@dataclass(frozen=True)
class AnatomyEntry:
    path: str
    symbols: list[str]


def _extract_symbols(text: str, pattern: re.Pattern[str]) -> list[str]:
    return [g for match in pattern.finditer(text) for g in match.groups() if g]


def _relevant_files(staging: str) -> list[Path]:
    root = Path(staging)
    return [
        path
        for path in root.rglob("*")
        if path.is_file()
        and path.suffix in _SCANNERS
        and not _SKIP_DIRS & set(path.relative_to(root).parts)
    ]


def scan(staging: str) -> dict[str, list[AnatomyEntry]]:
    """Group every source file under `staging` by its top-level directory
    ("area"), extracting shallow exported-symbol names per file.
    """
    root = Path(staging)
    index: dict[str, list[AnatomyEntry]] = {}
    for path in _relevant_files(staging):
        rel = path.relative_to(root)
        if len(rel.parts) < 2:
            continue  # AC-1 groups by area; root-level files have no area
        area = rel.parts[0]
        symbols = _extract_symbols(path.read_text(), _SCANNERS[path.suffix])
        index.setdefault(area, []).append(AnatomyEntry(path=str(rel), symbols=symbols))
    return index


def render_anatomy(index: dict[str, list[AnatomyEntry]]) -> str:
    """AC-1: the top-level `ANATOMY.md` -- one row per area, linking to its
    wiki page.
    """
    rows = "\n".join(
        f"| {area} | {len(entries)} | [{area}](docs/wiki/{area}.md) |"
        for area, entries in sorted(index.items())
    )
    return (
        "# Repository Anatomy\n\n"
        "Navigable map of the codebase. Each area links to its wiki page; "
        "open that before grepping.\n\n"
        "| Area | Files | Wiki |\n|---|---|---|\n" + rows + "\n"
    )


def render_wiki_pages(index: dict[str, list[AnatomyEntry]]) -> dict[str, str]:
    """AC-1: one `docs/wiki/{area}.md` per area, listing each file's
    shallow-scanned exported symbols.
    """
    pages: dict[str, str] = {}
    for area, entries in index.items():
        lines = [f"# {area}\n"]
        for entry in sorted(entries, key=lambda e: e.path):
            symbols = ", ".join(entry.symbols) if entry.symbols else "_no exported symbols_"
            lines.append(f"- `{entry.path}` -- {symbols}")
        pages[area] = "\n".join(lines) + "\n"
    return pages


def refresh_anatomy(staging: str) -> None:
    """Scan `staging` and write `ANATOMY.md` + `docs/wiki/*.md` into it, so
    the next commit carries an up-to-date index (AC-1).
    """
    root = Path(staging)
    index = scan(staging)
    (root / "ANATOMY.md").write_text(render_anatomy(index))
    wiki_dir = root / "docs" / "wiki"
    wiki_dir.mkdir(parents=True, exist_ok=True)
    for area, content in render_wiki_pages(index).items():
        (wiki_dir / f"{area}.md").write_text(content)

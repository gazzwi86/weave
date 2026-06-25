"""PostToolUse: mark wiki pages stale; pre-push freshness gate."""

import re
import sys
from datetime import datetime, timezone

from modules.common import PROJECT_ROOT, rel_from_root, is_tracked, wiki_page_for_path


def mark_anatomy_stale(payload: dict) -> None:
    """PostToolUse:Edit|Write — append a stale marker to the area's wiki page."""
    file_path = (payload.get("tool_input") or {}).get("file_path")
    if not file_path:
        return

    rel = rel_from_root(file_path)
    if not is_tracked(rel):
        return

    wiki_rel = wiki_page_for_path(rel)
    if not wiki_rel:
        return

    wiki_abs = PROJECT_ROOT / wiki_rel
    marker = f"<!-- stale: {rel} -->"

    try:
        body = wiki_abs.read_text(encoding="utf-8")
    except OSError:
        body = f"# {wiki_abs.stem}\n\n_(empty — run /anatomy)_\n"

    if marker in body:
        return

    stamp = datetime.now(timezone.utc).isoformat()
    wiki_abs.parent.mkdir(parents=True, exist_ok=True)
    wiki_abs.write_text(body + f"\n{marker} <!-- at: {stamp} -->\n", encoding="utf-8")


def check_anatomy_fresh(_payload: dict) -> None:
    """Wiki freshness gate. Used by the pre-push git hook.

    Run ad-hoc with: python3 .claude/scripts/hooks.py check-anatomy-fresh
    """
    wiki_dir = PROJECT_ROOT / "docs" / "wiki"
    if not wiki_dir.exists():
        return

    stale: list[tuple[str, str]] = []
    for f in sorted(wiki_dir.iterdir()):
        if f.suffix != ".md":
            continue
        for m in re.finditer(r"<!-- stale: (\S+) -->", f.read_text(encoding="utf-8")):
            stale.append((f.name, m.group(1)))

    if not stale:
        return

    files = " ".join(s[1] for s in stale)
    lines = "\n".join(f"  {wiki}: {file}" for wiki, file in stale)
    sys.stderr.write(
        f"check-anatomy-fresh: {len(stale)} stale wiki entries\n{lines}\n\n"
        f'run: claude -p "/anatomy refresh {files}"\n'
    )
    sys.exit(1)

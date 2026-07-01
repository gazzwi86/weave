#!/usr/bin/env python3
"""Derive and gate `.claude/HARNESS.md` — the harness element manifest.

Two modes:

    python3 .claude/scripts/harness_manifest.py generate   # (re)write HARNESS.md
    python3 .claude/scripts/harness_manifest.py --check     # structural parity gate

`generate` scans the harness (skills, agents, scripts, modules) and writes one
table row per element. It PRESERVES any human-authored Purpose / Invoked by /
Breaks without it / last-vouched-by cells already in the file; only NEW elements
get a stub row (Purpose seeded from the element's frontmatter description,
last-vouched-by = "TODO"). Rows whose element no longer exists are marked
"STALE — element removed" rather than silently dropped.

`--check` is the pre-push gate. STRUCTURAL ROW-PARITY is the hard rule: every
discovered element MUST have a row, else exit 2. A missing/TODO last-vouched-by
on an active element is a WARN to stderr (never a failure) — this avoids a
bootstrap deadlock where nothing can be pushed until every row is hand-vouched.
The same gate is reachable as the `check-harness-manifest` hooks.py handler.

The manifest is DERIVED, not hand-transcribed: the prose above the table is
regenerated every run, so only edit table cells — never the prose.
"""

import re
import sys
from pathlib import Path

# Robust against cwd: .claude/scripts/harness_manifest.py -> parents[2] == repo root.
# (git hooks run with cwd = repo root but without CLAUDE_PROJECT_DIR set.)
ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / ".claude" / "HARNESS.md"

COLUMNS = ["Element", "Type", "Purpose", "Invoked by", "Breaks without it", "Status", "last-vouched-by"]
TYPE_ORDER = {"skill": 0, "agent": 1, "script": 2, "module": 3}
ACTIVE = "active"
STALE = "STALE — element removed"
TODO = "TODO"

HEADER = """# Harness manifest — `.claude/HARNESS.md`

**DERIVED FILE — do not hand-edit this prose.** Rows are scaffolded by
`python3 .claude/scripts/harness_manifest.py generate`, which scans the harness
(skills, agents, scripts, modules) and preserves human-authored cells across
regeneration. Edit the *table cells* (Purpose / Invoked by / Breaks without it /
last-vouched-by), then re-run `generate`.

The pre-push gate (`check-harness-manifest`) enforces **structural row-parity**:
every discovered harness element must have a row (else the push is blocked).
`last-vouched-by: TODO` is a WARN, not a block — a human vouches for a row by
replacing TODO with `<name> <date>` once they have confirmed it is accurate.

"""


def _frontmatter_description(path: Path) -> str:
    """Pull the `description:` value from a markdown file's YAML frontmatter."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return ""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return ""
    dm = re.search(r"^description:\s*(.+)$", m.group(1), re.MULTILINE)
    if not dm:
        return ""
    return dm.group(1).strip().strip('"').strip("'").strip()


def discover() -> dict:
    """Return {(type, name): seed_purpose} for every harness element."""
    found: dict = {}
    skills = ROOT / ".claude" / "skills"
    for d in sorted(skills.glob("*/SKILL.md")):
        found[("skill", d.parent.name)] = _frontmatter_description(d)
    agents = ROOT / ".claude" / "agents"
    if agents.is_dir():
        for f in sorted(agents.glob("*.md")):
            found[("agent", f.stem)] = _frontmatter_description(f)
    scripts = ROOT / ".claude" / "scripts"
    for f in sorted([*scripts.glob("*.py"), *scripts.glob("*.sh")]):
        found[("script", f.name)] = ""
    for f in sorted((scripts / "modules").glob("*.py")):
        if f.name == "__init__.py":  # package marker, not a logical concern
            continue
        found[("module", f.name)] = ""
    return found


def _cell(s: str) -> str:
    """Make a string safe for one markdown table cell (no pipes, no newlines)."""
    return re.sub(r"\s+", " ", (s or "").replace("|", "/")).strip()


def parse_existing() -> dict:
    """Return {(type, name): {col: value}} parsed from the current manifest table."""
    rows: dict = {}
    if not MANIFEST.exists():
        return rows
    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) != len(COLUMNS):
            continue
        if cells[0] == "Element" or set("".join(cells)) <= {"-", ":", " "}:
            continue  # header or separator row
        row = dict(zip(COLUMNS, cells))
        rows[(row["Type"], row["Element"])] = row
    return rows


def build_rows() -> list:
    """Merge discovered elements with the existing table, preserving human cells."""
    discovered = discover()
    existing = parse_existing()
    rows = []
    for key in set(discovered) | set(existing):
        typ, name = key
        prev = existing.get(key, {})
        row = {"Element": name, "Type": typ}
        # Human-authored columns: keep what's there if non-empty; else seed/stub.
        row["Purpose"] = prev.get("Purpose") or _cell(discovered.get(key, ""))
        row["Invoked by"] = prev.get("Invoked by", "")
        row["Breaks without it"] = prev.get("Breaks without it", "")
        row["last-vouched-by"] = prev.get("last-vouched-by") or TODO
        row["Status"] = ACTIVE if key in discovered else STALE
        rows.append(row)
    rows.sort(key=lambda r: (TYPE_ORDER.get(r["Type"], 9), r["Element"]))
    return rows


def render(rows: list) -> str:
    head = "| " + " | ".join(COLUMNS) + " |"
    sep = "|" + "|".join(["---"] * len(COLUMNS)) + "|"
    body = ["| " + " | ".join(_cell(r[c]) for c in COLUMNS) + " |" for r in rows]
    return "\n".join([head, sep, *body]) + "\n"


def generate() -> None:
    rows = build_rows()
    n_active = sum(1 for r in rows if r["Status"] == ACTIVE)
    n_stale = len(rows) - n_active
    MANIFEST.write_text(HEADER + render(rows), encoding="utf-8")
    print(
        f"harness_manifest: wrote {MANIFEST.relative_to(ROOT)} — "
        f"{len(rows)} rows ({n_active} active, {n_stale} stale)"
    )


def check(_payload: dict = None) -> None:
    """Structural row-parity gate (shared by `--check` and the hooks.py handler).

    HARD: every discovered element must have a row, else exit 2.
    WARN: active rows still vouched TODO/empty, and stale rows (element gone).
    """
    discovered = discover()
    existing = parse_existing()

    missing = [f"{t}: {n}" for (t, n) in sorted(discovered) if (t, n) not in existing]
    if missing:
        sys.stderr.write(
            f"check-harness-manifest: FAIL — {len(missing)} harness element(s) have "
            f"no row in {MANIFEST.relative_to(ROOT)}:\n"
            + "\n".join(f"  - {m}" for m in missing)
            + "\n\nrun: python3 .claude/scripts/harness_manifest.py generate\n"
        )
        sys.exit(2)

    unvouched = [
        f"{t}: {n}"
        for (t, n), r in existing.items()
        if (t, n) in discovered and (r.get("last-vouched-by") or "").strip() in ("", TODO)
    ]
    stale = [f"{t}: {n}" for (t, n) in existing if (t, n) not in discovered]

    if unvouched:
        sys.stderr.write(
            f"check-harness-manifest: WARN — {len(unvouched)} active row(s) not yet "
            "vouched (last-vouched-by TODO/empty); a human should vouch before relying on them:\n"
            + "\n".join(f"  - {m}" for m in unvouched) + "\n"
        )
    if stale:
        sys.stderr.write(
            f"check-harness-manifest: WARN — {len(stale)} stale row(s) (element removed); "
            "prune from the manifest:\n"
            + "\n".join(f"  - {m}" for m in stale) + "\n"
        )

    print(
        f"check-harness-manifest: OK — {len(discovered)} elements, all have rows "
        f"({len(unvouched)} unvouched, {len(stale)} stale)."
    )


def main(argv: list) -> None:
    mode = argv[1] if len(argv) > 1 else ""
    if mode == "generate":
        generate()
    elif mode == "--check":
        check()
    else:
        sys.stderr.write(f"usage: {argv[0]} generate|--check\n")
        sys.exit(64)


if __name__ == "__main__":
    main(sys.argv)

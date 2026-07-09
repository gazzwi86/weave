"""TASK-010 static test (AC-6, ADR-001 mitigation 3): the four new v1 PM
tables must only ever be named in SQL inside `pm/` (the repo layer) or the
migration that creates them -- never in a route handler, service, or any
other module reaching for raw SQL. Grep-based, mirrors the "repo-layer-only
access" convention this codebase already enforces by code review; no such
automated check existed for any table before this task.
"""

from __future__ import annotations

from pathlib import Path

_SRC_ROOT = Path(__file__).resolve().parents[2] / "src" / "weave_backend"
_V1_PM_TABLES = ("project_contributors", "external_bindings", "cost_events", "project_prompts")
_ALLOWED_DIR = _SRC_ROOT / "pm"


def test_v1_pm_tables_named_only_inside_the_pm_repo_layer() -> None:
    offenders: list[str] = []
    for path in _SRC_ROOT.rglob("*.py"):
        if _ALLOWED_DIR in path.parents:
            continue
        text = path.read_text(encoding="utf-8")
        for table in _V1_PM_TABLES:
            if table in text:
                offenders.append(f"{path.relative_to(_SRC_ROOT)}: {table}")
    assert offenders == []

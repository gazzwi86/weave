"""TASK-009 (build-engine EPIC-008) unit tests: FR-031/AC-1 anatomy indexer.
`scan`/`render_anatomy`/`render_wiki_pages`/`refresh_anatomy` are pure
filesystem functions (no DB, no network, no LLM) -- shallow language-aware
symbol extraction, not a full parse (task brief's implementation hint).
"""

from __future__ import annotations

from pathlib import Path

from weave_backend.anatomy.indexer import (
    refresh_anatomy,
    render_anatomy,
    render_wiki_pages,
    scan,
)


def test_scan_groups_files_by_top_level_area_and_extracts_symbols(tmp_path: Path) -> None:
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "app.py").write_text(
        "def handler():\n    pass\n\nclass Widget:\n    pass\n"
    )
    (tmp_path / "frontend").mkdir()
    (tmp_path / "frontend" / "page.tsx").write_text(
        "export function Page() {}\nexport const Nav = () => null\n"
    )

    index = scan(str(tmp_path))

    assert {"handler", "Widget"} <= {s for e in index["backend"] for s in e.symbols}
    assert {"Page", "Nav"} <= {s for e in index["frontend"] for s in e.symbols}


def test_scan_skips_dependency_and_vcs_directories(tmp_path: Path) -> None:
    (tmp_path / "node_modules" / "pkg").mkdir(parents=True)
    (tmp_path / "node_modules" / "pkg" / "index.js").write_text("export function x() {}\n")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("junk")
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "__pycache__" / "x.pyc").write_text("junk")

    index = scan(str(tmp_path))

    assert index == {}


def test_scan_ignores_non_source_files(tmp_path: Path) -> None:
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "README.md").write_text("# hello\n")

    index = scan(str(tmp_path))

    assert index == {}


def test_render_anatomy_produces_area_table_with_wiki_links(tmp_path: Path) -> None:
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "app.py").write_text("def handler():\n    pass\n")
    index = scan(str(tmp_path))

    doc = render_anatomy(index)

    assert "# Repository Anatomy" in doc
    assert "backend" in doc
    assert "docs/wiki/backend.md" in doc


def test_render_wiki_pages_lists_files_and_symbols_per_area(tmp_path: Path) -> None:
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "app.py").write_text("def handler():\n    pass\n")
    index = scan(str(tmp_path))

    pages = render_wiki_pages(index)

    assert "backend" in pages
    assert "app.py" in pages["backend"]
    assert "handler" in pages["backend"]


def test_refresh_anatomy_writes_anatomy_md_and_wiki_tree_into_staging(tmp_path: Path) -> None:
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "app.py").write_text("def handler():\n    pass\n")

    refresh_anatomy(str(tmp_path))

    assert (tmp_path / "ANATOMY.md").exists()
    wiki_page = tmp_path / "docs" / "wiki" / "backend.md"
    assert wiki_page.exists()
    assert "handler" in wiki_page.read_text()

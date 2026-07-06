"""BE-TASK-008 gate 4 (package-existence, AC-3): `check_package_existence`
against a real temp workspace on disk -- pure filesystem/regex parsing, no
external boundary to mock.
"""

from __future__ import annotations

from pathlib import Path

from weave_backend.generation.package_checker import check_package_existence


def _write_manifests(root: Path, *, py_deps: str = "", ts_deps: str = "") -> None:
    (root / "backend").mkdir(parents=True, exist_ok=True)
    (root / "frontend").mkdir(parents=True, exist_ok=True)
    (root / "backend" / "pyproject.toml").write_text(
        f'[project]\nname = "app"\nversion = "0.1.0"\ndependencies = [{py_deps}]\n'
    )
    (root / "frontend" / "package.json").write_text(f'{{"dependencies": {{{ts_deps}}}}}')


def test_check_package_existence_returns_empty_for_declared_python_import(tmp_path: Path) -> None:
    _write_manifests(tmp_path, py_deps='"fastapi>=0.100"')
    (tmp_path / "backend" / "main.py").write_text("import fastapi\n")

    assert check_package_existence(str(tmp_path)) == []


def test_check_package_existence_flags_undeclared_python_import(tmp_path: Path) -> None:
    _write_manifests(tmp_path)
    (tmp_path / "backend" / "main.py").write_text("import some_ghost_package\n")

    unresolved = check_package_existence(str(tmp_path))

    assert {"import": "some_ghost_package", "language": "python"} in unresolved


def test_check_package_existence_returns_empty_for_declared_ts_import(tmp_path: Path) -> None:
    _write_manifests(tmp_path, ts_deps='"react": "^18.0.0"')
    (tmp_path / "frontend" / "page.tsx").write_text('import React from "react";\n')

    assert check_package_existence(str(tmp_path)) == []


def test_check_package_existence_flags_undeclared_ts_import(tmp_path: Path) -> None:
    _write_manifests(tmp_path)
    (tmp_path / "frontend" / "page.tsx").write_text('import ghost from "ghost-lib";\n')

    unresolved = check_package_existence(str(tmp_path))

    assert {"import": "ghost-lib", "language": "typescript"} in unresolved


def test_check_package_existence_ignores_nextjs_path_alias_imports(tmp_path: Path) -> None:
    _write_manifests(tmp_path)
    (tmp_path / "frontend" / "page.tsx").write_text('import { Button } from "@/components/ui";\n')

    assert check_package_existence(str(tmp_path)) == []


def test_check_package_existence_ignores_stdlib_python_import(tmp_path: Path) -> None:
    _write_manifests(tmp_path)
    (tmp_path / "backend" / "main.py").write_text("import json\nimport os\n")

    assert check_package_existence(str(tmp_path)) == []

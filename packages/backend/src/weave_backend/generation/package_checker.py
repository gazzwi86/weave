"""BE-TASK-008 gate 4 (package-existence, AC-3): every `import`/`from ...
import` (Python) and `import ... from`/`require(...)` (TypeScript) in a
generated workspace must resolve to either a declared dependency, a stdlib
module, or a local module already present in the workspace.

ponytail: checks declared dependencies against `backend/pyproject.toml`'s
`[project.dependencies]` and `frontend/package.json`'s `dependencies`/
`devDependencies` -- not the full `uv.lock`/`package-lock.json` the task
brief's implementation hint names. The manifest is the source lockfiles are
generated from, so it resolves the same "does this package exist at all"
question with far less parsing; upgrade to the real lockfiles only if a
manifest-vs-lock drift actually bites (e.g. a dep declared but never
installed).
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

_PY_IMPORT = re.compile(r"^\s*(?:from|import)\s+([\w]+)")
_TS_IMPORT = re.compile(r"""(?:import\s.*?from\s+|require\()\s*['"]([^'"./][^'"]*)['"]""")
_PY_STDLIB = set(sys.stdlib_module_names) | {"__future__"}


def _py_imports(root: Path) -> set[str]:
    names: set[str] = set()
    for path in root.rglob("*.py"):
        for line in path.read_text(errors="ignore").splitlines():
            match = _PY_IMPORT.match(line)
            if match:
                names.add(match.group(1))
    return names


def _ts_imports(root: Path) -> set[str]:
    # ponytail: "@/..." is Next.js's local path alias, not an npm scope --
    # skipped here rather than taught to a real tsconfig-paths resolver.
    names: set[str] = set()
    for path in list(root.rglob("*.ts")) + list(root.rglob("*.tsx")):
        for match in _TS_IMPORT.finditer(path.read_text(errors="ignore")):
            package = match.group(1)
            if package.startswith("@/"):
                continue
            parts = package.split("/")
            names.add("/".join(parts[:2]) if package.startswith("@") else parts[0])
    return names


def _declared_py_deps(root: Path) -> set[str]:
    pyproject = root / "backend" / "pyproject.toml"
    if not pyproject.exists():
        return set()
    data = tomllib.loads(pyproject.read_text())
    deps = data.get("project", {}).get("dependencies", [])
    return {re.split(r"[<>=!~\[; ]", dep, maxsplit=1)[0] for dep in deps}


def _declared_ts_deps(root: Path) -> set[str]:
    package_json = root / "frontend" / "package.json"
    if not package_json.exists():
        return set()
    data = json.loads(package_json.read_text())
    return set(data.get("dependencies", {})) | set(data.get("devDependencies", {}))


def _is_local_module(root: Path, name: str) -> bool:
    return any(root.rglob(f"{name}.py")) or any(root.rglob(name)) if name else False


def check_package_existence(workspace: str) -> list[dict[str, str]]:
    """AC-3: `[{"import": name, "language": "python"|"typescript"}, ...]`
    for every import that resolves to none of declared/stdlib/local.
    """
    root = Path(workspace)
    unresolved: list[dict[str, str]] = []

    py_known = _declared_py_deps(root) | _PY_STDLIB
    for name in sorted(_py_imports(root) - py_known):
        if not _is_local_module(root, name):
            unresolved.append({"import": name, "language": "python"})

    ts_known = _declared_ts_deps(root)
    for name in sorted(_ts_imports(root) - ts_known):
        unresolved.append({"import": name, "language": "typescript"})

    return unresolved

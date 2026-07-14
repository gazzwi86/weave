"""CE-V1-TASK-014 AC-003-07: CI structural assert, `corpus-is-read-side-only`
(program-level ADR-003). The document corpus store (S3 passages + the
in-memory vector index) never joins CE-WRITE-1's graph-mutation path, and no
`/api/corpus/*` route accepts a write verb -- mirrors
`test_ingest_no_second_mutation_path.py`'s pattern for `ingest/`.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

CORPUS_DIR = Path(__file__).parents[2] / "src" / "weave_backend" / "corpus"
ROUTERS_DIR = Path(__file__).parents[2] / "src" / "weave_backend" / "routers"

#: Reaching the CE-WRITE-1 mutation path or the pipeline dispatcher from
#: corpus/ would let a document-embedding job write graph triples outside
#: SHACL validation -- the corpus store is read-side only by construction.
FORBIDDEN_MODULES = {"weave_backend.operations.pipeline", "weave_backend.routers.operations"}

_WRITE_VERBS = ("post", "put", "patch", "delete")


def _imported_modules(tree: ast.Module) -> set[str]:
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module)
    return modules


def test_corpus_package_never_imports_the_ce_write_1_mutation_path() -> None:
    corpus_files = sorted(CORPUS_DIR.rglob("*.py"))
    assert corpus_files, f"no source files found under {CORPUS_DIR}"

    violations = []
    for path in corpus_files:
        tree = ast.parse(path.read_text(), filename=str(path))
        hits = _imported_modules(tree) & FORBIDDEN_MODULES
        if hits:
            violations.append(f"{path.name} imports the graph-mutation path: {hits}")

    assert not violations, (
        f"corpus/ must stay read-side only (ADR-003): {violations}"
    )


def test_no_write_verb_route_is_registered_under_api_corpus() -> None:
    router_files = sorted(ROUTERS_DIR.rglob("*.py"))
    assert router_files

    violations = []
    for path in router_files:
        text = path.read_text()
        for verb in _WRITE_VERBS:
            for match in re.finditer(rf'@\w+\.{verb}\(\s*["\']([^"\']*)["\']', text):
                route_path = match.group(1)
                if "corpus" in route_path:
                    violations.append(f"{path.name}: @{verb}({route_path!r})")

    assert not violations, f"no write verb allowed under /api/corpus/*: {violations}"

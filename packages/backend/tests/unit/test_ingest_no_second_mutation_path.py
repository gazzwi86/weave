"""CE-V1-TASK-012 AC-001-08: CI structural assert, `no-second-mutation-path-ingest`.

CE-WRITE-1 (`routers.operations._run_apply`, ADR-006 dispatch-reuse) is the
ONE validated mutation entry point. `ingest/` may call `_run_apply` (that IS
the one path -- an ingest-accept handler dispatching through it is correct),
but must never reach the RDF store directly, and must never call the
pipeline's private commit internals directly (that would skip `_run_apply`'s
RBAC/spike-guard/workspace-resolution -- the whole reason ADR-006 says
"reuse the dispatcher, don't reimplement it").

`operations/ingest_provenance.py` is a deliberate, narrow exception: it
appends provenance-only triples (an artefact `prov:Entity`, an ingest
`prov:Activity`) the same way `operations/provenance.py` already does
directly -- not a working-graph mutation, so it lives under `operations/`
(exempt) rather than `ingest/` by construction. This test only scans
`ingest/`.
"""

from __future__ import annotations

import ast
from pathlib import Path

INGEST_DIR = Path(__file__).parents[2] / "src" / "weave_backend" / "ingest"

#: Reaching the RDF store directly bypasses CE-WRITE-1's SHACL validation.
FORBIDDEN_MODULES = {"weave_backend.rdf.oxigraph_client"}

#: Calling these directly skips `_run_apply`'s RBAC/spike-guard checks --
#: the correct call is `routers.operations._run_apply` (or the router import
#: `from weave_backend.routers.operations import _run_apply`), never these.
FORBIDDEN_PIPELINE_NAMES = {"_commit", "_apply_uncached", "apply_operations_request"}


def _imported_names(tree: ast.Module) -> tuple[set[str], set[str]]:
    """Returns (imported module dotted-paths, imported `from X import Y` names)."""
    modules: set[str] = set()
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module)
            if node.module == "weave_backend.operations.pipeline":
                names.update(alias.name for alias in node.names)
    return modules, names


def test_ingest_package_never_imports_the_rdf_store_or_pipeline_internals() -> None:
    ingest_files = sorted(INGEST_DIR.rglob("*.py"))
    assert ingest_files, f"no source files found under {INGEST_DIR}"

    violations: list[str] = []
    for path in ingest_files:
        tree = ast.parse(path.read_text(), filename=str(path))
        modules, pipeline_names = _imported_names(tree)

        store_hits = modules & FORBIDDEN_MODULES
        if store_hits:
            violations.append(f"{path.name} imports RDF store directly: {store_hits}")

        internal_hits = pipeline_names & FORBIDDEN_PIPELINE_NAMES
        if internal_hits:
            violations.append(f"{path.name} imports pipeline internals: {internal_hits}")

    assert not violations, (
        "ingest/ must dispatch every graph mutation through CE-WRITE-1's "
        f"_run_apply, never write the store or the pipeline directly: {violations}"
    )

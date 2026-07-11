"""AC-6: the single shape-compatibility matrix (`packages/shared/widget-compat.json`).
Loaded once at import -- the backend resolver and the frontend change-viz menu
both read this exact file, so drift between them is structurally impossible
(no second hand-copied table). `test_compatibility_matrix_single_source`
compares this loaded path's bytes against the frontend's imported copy.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Final

from weave_backend.schemas.dashboard import ComponentType


def _find_shared_dir(module_file: Path) -> Path:
    """Walk up from `module_file` to the `packages/` ancestor and return
    `packages/shared/`. A fixed `parents[N]` climb breaks when mutmut stages
    tests under an extra `packages/backend/mutants/...` directory level
    (2026-07-12); keying off the `packages` dir *name* instead of a hop count
    is depth-independent, so it resolves correctly from both the real tree
    and mutmut's staged copy.
    """
    for ancestor in module_file.resolve().parents:
        if ancestor.name == "packages":
            return ancestor / "shared"
    raise FileNotFoundError(f"no 'packages' ancestor directory found above {module_file}")


COMPAT_PATH: Final[Path] = _find_shared_dir(Path(__file__)) / "widget-compat.json"

#: shape -> ordered list of compatible components; index 0 is the rule-table
#: default (`PRIMARY`). Static repo file (not user input) -- the json.loads
#: result is trusted the same way the rest of the codebase trusts config.
COMPAT: Final[dict[str, list[ComponentType]]] = json.loads(COMPAT_PATH.read_text())

PRIMARY: Final[dict[str, ComponentType]] = {
    shape: components[0] for shape, components in COMPAT.items()
}

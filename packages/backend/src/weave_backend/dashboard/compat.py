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

#: dashboard/compat.py -> weave_backend -> src -> backend -> packages
COMPAT_PATH: Final[Path] = Path(__file__).resolve().parents[4] / "shared" / "widget-compat.json"

#: shape -> ordered list of compatible components; index 0 is the rule-table
#: default (`PRIMARY`). Static repo file (not user input) -- the json.loads
#: result is trusted the same way the rest of the codebase trusts config.
COMPAT: Final[dict[str, list[ComponentType]]] = json.loads(COMPAT_PATH.read_text())

PRIMARY: Final[dict[str, ComponentType]] = {
    shape: components[0] for shape, components in COMPAT.items()
}

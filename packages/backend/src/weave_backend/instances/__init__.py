"""CE-TASK-005: instance CRUD (E2-S1/-S2) + browse/search (E2-S4) helpers.

Every mutation still routes through the shared CE-WRITE-1 pipeline
(`routers/operations.py::_run_apply`) -- these modules only hold the
instances-router-specific logic that sits *around* that shared entry point
(duplicate pre-check, delete-confirm preview, browse query-building,
violation-message humanising).
"""

from __future__ import annotations

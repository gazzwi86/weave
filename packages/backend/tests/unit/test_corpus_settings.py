"""CE-V1-TASK-014 AC-003-03: `corpus.retrieval_top_k` PLAT-SETTINGS-1
cascade resolution -- mirrors `ingest/confidence.py`'s
`resolve_confidence_threshold` (and its `_FakeConnection` shape,
`test_ingest_confidence.py`) exactly (v1-delta.md §6 default 8).
"""

from __future__ import annotations

import json
from typing import Any

from weave_backend.corpus.settings import (
    DEFAULT_RETRIEVAL_TOP_K,
    RETRIEVAL_TOP_K_SETTING_KEY,
    resolve_retrieval_top_k,
)
from weave_backend.settings.scope import workspace_iri

_TENANT_ID = "acme-corp"
_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111"
_WORKSPACE_IRI = workspace_iri(_TENANT_ID, _WORKSPACE_ID)


class _FakeConnection:
    def __init__(self, rows: dict[tuple[str, str], dict[str, Any]] | None = None) -> None:
        self.rows = rows or {}

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        assert "scope_iri = ANY($2)" in query
        _tenant_id, scope_iris, key = args
        return [
            {"scope_iri": iri, "scope": row["scope"], "value": row["value"]}
            for iri in scope_iris
            if (row := self.rows.get((iri, key))) is not None
        ]


async def test_should_default_to_eight_when_nothing_set() -> None:
    """DoD invariant: no literal 8 outside settings defaults."""
    conn = _FakeConnection()

    top_k = await resolve_retrieval_top_k(conn, tenant_id=_TENANT_ID, workspace_id=_WORKSPACE_ID)

    assert top_k == DEFAULT_RETRIEVAL_TOP_K == 8


async def test_should_use_resolved_setting_when_present() -> None:
    key = (_WORKSPACE_IRI, RETRIEVAL_TOP_K_SETTING_KEY)
    conn = _FakeConnection({key: {"scope": "workspace", "value": json.dumps(5)}})

    top_k = await resolve_retrieval_top_k(conn, tenant_id=_TENANT_ID, workspace_id=_WORKSPACE_ID)

    assert top_k == 5

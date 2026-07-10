"""AC-002-04: confidence-flag threshold cascade resolution. Mirrors
`requests/cost.py::resolve_cost_cap` + its `_FakeConnection` test shape
(`test_billing_caps.py`) -- `resolve_setting` has no built-in default,
so DEFAULT_CONFIDENCE_THRESHOLD is `ingest/confidence.py`'s own business
default when nothing is set anywhere in the PLAT-SETTINGS-1 cascade.
"""

from __future__ import annotations

import json
from typing import Any

from weave_backend.ingest.confidence import (
    CONFIDENCE_THRESHOLD_SETTING_KEY,
    DEFAULT_CONFIDENCE_THRESHOLD,
    resolve_confidence_threshold,
)

from weave_backend.settings.scope import workspace_iri

_TENANT_ID = "acme-corp"
_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111"
_WORKSPACE_IRI = workspace_iri(_TENANT_ID, _WORKSPACE_ID)
_COMPANY_IRI = "urn:weave:tenant:acme-corp:company"


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


async def test_resolve_confidence_threshold_defaults_when_nothing_set() -> None:
    """DoD invariant: no literal 0.6 outside settings defaults -- this default
    lives in exactly one place, `DEFAULT_CONFIDENCE_THRESHOLD`.
    """
    conn = _FakeConnection()

    threshold = await resolve_confidence_threshold(
        conn, tenant_id=_TENANT_ID, workspace_id=_WORKSPACE_ID
    )

    assert threshold == DEFAULT_CONFIDENCE_THRESHOLD == 0.6


async def test_resolve_confidence_threshold_honours_cascade_override() -> None:
    conn = _FakeConnection(
        {
            (_COMPANY_IRI, CONFIDENCE_THRESHOLD_SETTING_KEY): {
                "scope": "company",
                "value": json.dumps(0.8),
            }
        }
    )

    threshold = await resolve_confidence_threshold(
        conn, tenant_id=_TENANT_ID, workspace_id=_WORKSPACE_ID
    )

    assert threshold == 0.8

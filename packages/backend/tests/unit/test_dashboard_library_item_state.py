"""PLAT-V1-TASK-015 AC-6: library cards carry the same "source engine not
yet available" tag any widget's honest-state matrix uses -- pure mapping,
no DB.
"""

from __future__ import annotations

from datetime import UTC, datetime

from weave_backend.dashboard.store import LibraryItemRow
from weave_backend.routers.dashboard import _to_library_item_out
from weave_backend.schemas.dashboard import WidgetSpec


def _library_row(contracts: list[str]) -> LibraryItemRow:
    return LibraryItemRow(
        id="lib-1",
        name="n",
        description=None,
        author_principal_iri="urn:weave:tenant:t:principal:u",
        published_at=datetime.now(UTC),
        spec=WidgetSpec(
            component_type="kpi_card",
            title="t",
            data_source_contracts=contracts,
            bindings={"field": "entity_count_by_kind", "aggregate": "sum"},
            column_span=3,
        ),
    )


def test_ga_sourced_item_tagged_available() -> None:
    out = _to_library_item_out(_library_row(["CE-METRICS-1"]))
    assert out.source_available is True


def test_non_ga_sourced_item_tagged_unavailable() -> None:
    out = _to_library_item_out(_library_row(["BUILD-METRICS-1"]))
    assert out.source_available is False

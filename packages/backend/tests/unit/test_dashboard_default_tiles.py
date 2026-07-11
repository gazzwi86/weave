"""AC-2/AC-8: fixed tile catalogue shape + role-appropriate starter map --
pure functions, no DB.
"""

from __future__ import annotations

from weave_backend.dashboard.default_tiles import (
    DEFAULT_TILES,
    STARTERS_BY_ROLE,
    resolve_starter_role,
    starter_specs_for_role,
)


def test_default_tile_catalogue_shape() -> None:
    """AC-2: six tiles, every one bound to CE-METRICS-1, column spans within
    the 12-col bento grid (layout-grid.md), titles unique (used as the
    starter-map lookup key).
    """
    assert len(DEFAULT_TILES) == 6
    titles = [tile.title for tile in DEFAULT_TILES]
    assert len(titles) == len(set(titles))
    for tile in DEFAULT_TILES:
        assert tile.data_source_contracts == ["CE-METRICS-1"]
        assert 1 <= tile.column_span <= 12
        assert "field" in tile.bindings


def test_starter_role_map() -> None:
    """AC-8: every starter title in the role map resolves to a real tile in
    the catalogue; `resolve_starter_role` picks the highest-ranked role
    present and falls back to `read` for unrecognised/empty input.
    """
    catalogue_titles = {tile.title for tile in DEFAULT_TILES}
    for titles in STARTERS_BY_ROLE.values():
        assert set(titles) <= catalogue_titles

    assert resolve_starter_role([]) == "read"
    assert resolve_starter_role(["bogus-role"]) == "read"
    assert resolve_starter_role(["read", "publish"]) == "publish"
    assert resolve_starter_role(["author"]) == "author"

    starters = starter_specs_for_role("publish")
    assert [tile.title for tile in starters] == STARTERS_BY_ROLE["publish"]

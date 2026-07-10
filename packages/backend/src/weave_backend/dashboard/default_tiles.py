"""AC-2/AC-8: the fixed, hand-composed tenant-default tile catalogue and the
role-appropriate starter map (E1-S0, E1-S6). Both are drawn from the same
six ``WidgetSpec``s -- no separate starter-only specs.

Keep this catalogue in sync with the literal JSONB in
``migrations/0046_widget_state_backfill.sql`` -- the backfill migration is
frozen history and can't import this module (the migration runner executes
plain ``.sql``, see ``db/migrate.py``), so the two are duplicated by
necessity. ``test_default_tile_catalogue_shape`` guards this module's shape;
nothing guards the SQL copy staying in sync short of code review.
"""

from __future__ import annotations

from weave_backend.rbac import ROLE_RANK
from weave_backend.schemas.dashboard import WidgetSpec

_CE_METRICS_1 = ["CE-METRICS-1"]

#: Order is significant -- it is the seeded grid ``position`` (0-5).
DEFAULT_TILES: list[WidgetSpec] = [
    WidgetSpec(
        component_type="kpi_card",
        title="Entities in model",
        data_source_contracts=_CE_METRICS_1,
        bindings={"field": "entity_count_by_kind", "aggregate": "sum"},
        column_span=3,
    ),
    WidgetSpec(
        component_type="bar_chart",
        title="Entities by kind",
        data_source_contracts=_CE_METRICS_1,
        bindings={"field": "entity_count_by_kind"},
        column_span=6,
    ),
    WidgetSpec(
        component_type="kpi_card",
        title="Latest published version",
        data_source_contracts=_CE_METRICS_1,
        bindings={"field": "latest_version"},
        column_span=3,
    ),
    WidgetSpec(
        component_type="kpi_card",
        title="Draft vs published changes",
        data_source_contracts=_CE_METRICS_1,
        bindings={"field": "draft_published_delta"},
        column_span=3,
    ),
    # Pending-aware (contracts.md CE-METRICS-1 note): may render {"pending":
    # true} instead of counts.
    WidgetSpec(
        component_type="bar_chart",
        title="SHACL errors by severity",
        data_source_contracts=_CE_METRICS_1,
        bindings={"field": "shacl_errors_by_severity"},
        column_span=6,
    ),
    # Pending-aware: no producer until the post-v1 reasoner lands, so this
    # renders "counts pending" through v1 (contracts.md CE-METRICS-1 note).
    WidgetSpec(
        component_type="kpi_card",
        title="OWL inconsistencies",
        data_source_contracts=_CE_METRICS_1,
        bindings={"field": "owl_inconsistencies"},
        column_span=3,
    ),
]

#: E1-S6: role -> starter tile titles, drawn from DEFAULT_TILES above.
#: Role names mirror rbac.ROLE_RANK (project-role vocabulary), the only
#: ranked role vocabulary this codebase defines -- "role = highest authority
#: level from M1 role_bindings" resolves to the highest-ranked entry in a
#: principal's RoleGrant list (see resolve_starter_role below).
STARTERS_BY_ROLE: dict[str, list[str]] = {
    "publish": ["SHACL errors by severity", "Entities by kind"],
    "author": ["Draft vs published changes", "Entities by kind"],
    "read": ["Entities in model", "Latest published version"],
}

_TILES_BY_TITLE: dict[str, WidgetSpec] = {tile.title: tile for tile in DEFAULT_TILES}

_DEFAULT_STARTER_ROLE = "read"


def resolve_starter_role(role_names: list[str]) -> str:
    """AC-8: highest-ranked role among ``role_names`` that has a starter
    set; unrecognised/empty input falls back to ``read`` (test_starter_role_map).
    """
    ranked = [role for role in role_names if role in STARTERS_BY_ROLE]
    if not ranked:
        return _DEFAULT_STARTER_ROLE
    return max(ranked, key=lambda role: ROLE_RANK.get(role, -1))


def starter_specs_for_role(role: str) -> list[WidgetSpec]:
    titles = STARTERS_BY_ROLE.get(role, STARTERS_BY_ROLE[_DEFAULT_STARTER_ROLE])
    return [_TILES_BY_TITLE[title] for title in titles]

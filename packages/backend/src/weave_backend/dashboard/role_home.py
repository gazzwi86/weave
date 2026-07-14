"""PLAT-V1-TASK-017: "What can Weave do for you?" role-home content --
capability table, engine-gated coming-soon rows, next-action priority rule,
and the completeness-map projection (E10-S1..S3). Pure composition over
TASK-016's `bindings.CATEGORIES` + TASK-010's SWR tiles (implementation
hint: no new data-fetching path) -- the DB/HTTP wiring lives in
`routers/role_home.py`, this module is deliberately dependency-free so its
rules are unit-testable without Postgres/CE.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from weave_backend.dashboard import availability
from weave_backend.rbac import ROLE_RANK

#: Authority ordering (M1 schema, Design Decisions table) -- distinct from
#: `default_tiles.STARTERS_BY_ROLE`, which stops at `publish`; role-home's
#: content table has an `admin` tier the starter tiles don't need.
_LEVELS: list[str] = ["read", "author", "publish", "admin"]

#: Role->content table (normative, brief §"Role→content table"). Additive
#: per level -- `capabilities_for_level` accumulates every level up to and
#: including the requested one, so a higher level is always a strict
#: superset (epic AC role-matrix).
_LEVEL_ADDITIONS: dict[str, list[dict[str, str]]] = {
    "read": [
        {"id": "explore-model", "label": "Explore dashboards", "href": "/dashboard"},
        {"id": "view-model", "label": "View the model", "href": "/constitution"},
        {"id": "view-compliance", "label": "View compliance status", "href": "/compliance"},
    ],
    "author": [
        {
            "id": "edit-nl",
            "label": "Edit the model in plain language",
            "href": "/constitution",
        },
        {"id": "pin-widgets", "label": "Pin and publish widgets", "href": "/dashboard"},
    ],
    "publish": [
        {
            "id": "publish-versions",
            "label": "Publish versions",
            "href": "/constitution/versions",
        },
        {"id": "author-shapes", "label": "Author shapes", "href": "/constitution/shapes"},
    ],
    "admin": [
        {"id": "settings", "label": "Manage settings", "href": "/settings"},
        {"id": "members", "label": "Manage members", "href": "/settings/members"},
        {"id": "budgets", "label": "Manage budgets", "href": "/settings/billing"},
    ],
}

#: Engine-gated rows (all "coming soon" at M2, brief §"Role→content table"
#: footer) -- one shared availability check with FR-015's widget-category
#: gating (AC-2), never a second registry.
_ENGINE_GATED_ROWS: list[dict[str, str]] = [
    {
        "id": "build-generate",
        "label": "Generate an app from your model",
        "engine": "build",
        "coming_soon": "Available when the Build Engine ships",
    },
    {
        "id": "events-automate",
        "label": "Automate a process",
        "engine": "events",
        "coming_soon": "Available when the Events & Actions Engine ships",
    },
    {
        "id": "explorer-collaborate",
        "label": "Collaborate live on the canvas",
        "engine": "explorer",
        "coming_soon": "Available when Explorer realtime ships",
    },
]


def authority_level(role_names: list[str]) -> str:
    """Highest of read/author/publish/admin among a principal's JWT role
    grants -- same JWT-`roles`-claim signal `default_tiles.resolve_starter_role`
    uses (TASK-010 precedent), extended to the `admin` tier. Unrecognised or
    empty input defaults to `read` -- fail closed, never over-grant.
    """
    ranked = [role for role in role_names if role in _LEVELS]
    if not ranked:
        return "read"
    return max(ranked, key=lambda role: ROLE_RANK[role])


def capabilities_for_level(level: str) -> list[dict[str, Any]]:
    """AC-1/AC-4: every capability at `level` and below, all `available`
    (role-home only ever lists what the caller's authority already grants --
    the RBAC filtering the epic AC calls out is this list simply never
    growing past the caller's own level).
    """
    idx = _LEVELS.index(level) if level in _LEVELS else 0
    rows: list[dict[str, Any]] = []
    for lvl in _LEVELS[: idx + 1]:
        for cap in _LEVEL_ADDITIONS[lvl]:
            rows.append({**cap, "available": True})
    return rows


def engine_gated_rows() -> list[dict[str, Any]]:
    """AC-2: same `availability` registry FR-015's widget-category gating
    reads -- divergence between the two surfaces is impossible by
    construction, not by a shared fixture alone.
    """
    rows: list[dict[str, Any]] = []
    for row in _ENGINE_GATED_ROWS:
        ga = availability.is_ga(row["engine"])
        entry: dict[str, Any] = {"id": row["id"], "label": row["label"], "available": ga}
        if not ga:
            entry["coming_soon"] = row["coming_soon"]
        rows.append(entry)
    return rows


@dataclass(frozen=True)
class NextActionMetrics:
    """Bundles the live signals the priority rule below decides over."""

    shacl_violations: int
    coverage_gap_count: int
    draft_published_delta: int
    unassigned_users: int = 0


def next_action_rule(metrics: NextActionMetrics, level: str) -> dict[str, str]:
    """AC-7 (brief §"Next-action priority rule"): first match wins.
    `SHACL violations > 0` -> resolve errors; else `coverage_gap count > 0`
    -> fill gaps; else `draft_published_delta > 0` -> publish version; else
    (admin only) `unassigned users > 0` -> assign roles; else -> explore.
    """
    if metrics.shacl_violations > 0:
        return {
            "label": f"Resolve {metrics.shacl_violations} SHACL violations",
            "href": "/compliance",
        }
    if metrics.coverage_gap_count > 0:
        return {
            "label": f"Fill coverage gaps ({metrics.coverage_gap_count} missing links)",
            "href": "/constitution",
        }
    if metrics.draft_published_delta > 0:
        return {
            "label": f"Publish draft version ({metrics.draft_published_delta} changes)",
            "href": "/constitution/versions",
        }
    if level == "admin" and metrics.unassigned_users > 0:
        return {
            "label": f"Assign {metrics.unassigned_users} unassigned users a role",
            "href": "/settings/members",
        }
    return {"label": "Explore the model", "href": "/dashboard"}


def completeness_map(
    *, kinds: list[str], counts: dict[str, Any], gaps: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """AC-3: per-kind coverage over the authoritative `kinds` list (caller
    resolves this from `GET /api/ontology/types`, CE-READ-1 -- never a
    hand-copied list here). `counts`/`gaps` come straight from TASK-016's
    `completeness` binding rows -- no per-kind derivation logic platform-side,
    only a projection keyed on the kind list. A kind with no instances and
    no gap rows still appears, at zero -- proves no silent drop.
    """
    gap_counts: dict[str, int] = {}
    for gap in gaps:
        kind = gap.get("kind")
        if kind:
            gap_counts[kind] = gap_counts.get(kind, 0) + 1
    return [
        {
            "kind": kind,
            "instance_count": counts.get(kind, 0) if isinstance(counts, dict) else 0,
            "coverage_gap_count": gap_counts.get(kind, 0),
        }
        for kind in kinds
    ]

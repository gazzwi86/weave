"""PLAT-V1-TASK-017 unit tests: pure role-home logic -- authority level,
capability table, engine-gated coming-soon rows, next-action priority rule,
and the completeness-map projection. No DB/HTTP -- all pure functions
(implementation hint: reuse only, no new fetch paths).
"""

from __future__ import annotations

import pytest

from weave_backend.dashboard import role_home


@pytest.mark.parametrize(
    ("roles", "expected"),
    [
        ([], "read"),
        (["read"], "read"),
        (["author"], "author"),
        (["publish"], "publish"),
        (["admin"], "admin"),
        (["read", "publish"], "publish"),
        (["unknown-role"], "read"),
    ],
)
def test_authority_level(roles: list[str], expected: str) -> None:
    assert role_home.authority_level(roles) == expected


@pytest.mark.parametrize(
    ("level", "expected_ids"),
    [
        ("read", {"explore-model", "view-model", "view-compliance"}),
        (
            "author",
            {"explore-model", "view-model", "view-compliance", "edit-nl", "pin-widgets"},
        ),
        (
            "publish",
            {
                "explore-model",
                "view-model",
                "view-compliance",
                "edit-nl",
                "pin-widgets",
                "publish-versions",
                "author-shapes",
            },
        ),
        (
            "admin",
            {
                "explore-model",
                "view-model",
                "view-compliance",
                "edit-nl",
                "pin-widgets",
                "publish-versions",
                "author-shapes",
                "settings",
                "members",
                "budgets",
            },
        ),
    ],
)
def test_capabilities_table_by_level(level: str, expected_ids: set[str]) -> None:
    """AC-4/epic role-matrix: capabilities are strictly additive/cumulative
    per level -- Viewer (read) never sees author-or-above ids.
    """
    ids = {cap["id"] for cap in role_home.capabilities_for_level(level)}
    assert ids == expected_ids
    assert all(cap["available"] is True for cap in role_home.capabilities_for_level(level))


def test_engine_gated_rows_coming_soon() -> None:
    """AC-2: only CE GA at M2 -- Build/Events/Explorer rows render
    `available: false` with a one-line `coming_soon` description, never
    hidden.
    """
    rows = role_home.engine_gated_rows()
    assert {row["id"] for row in rows} == {
        "build-generate",
        "events-automate",
        "explorer-collaborate",
    }
    for row in rows:
        assert row["available"] is False
        assert row["coming_soon"]


@pytest.mark.parametrize(
    ("metrics", "level", "expected_label_fragment"),
    [
        (
            role_home.NextActionMetrics(
                shacl_violations=3, coverage_gap_count=2, draft_published_delta=1
            ),
            "publish",
            "3 SHACL violations",
        ),
        (
            role_home.NextActionMetrics(
                shacl_violations=0, coverage_gap_count=5, draft_published_delta=1
            ),
            "author",
            "5 missing links",
        ),
        (
            role_home.NextActionMetrics(
                shacl_violations=0, coverage_gap_count=0, draft_published_delta=7
            ),
            "publish",
            "7 changes",
        ),
        (
            role_home.NextActionMetrics(
                shacl_violations=0,
                coverage_gap_count=0,
                draft_published_delta=0,
                unassigned_users=4,
            ),
            "admin",
            "4 unassigned",
        ),
        (
            role_home.NextActionMetrics(
                shacl_violations=0,
                coverage_gap_count=0,
                draft_published_delta=0,
                unassigned_users=4,
            ),
            "author",
            "Explore",
        ),
        (
            role_home.NextActionMetrics(
                shacl_violations=0, coverage_gap_count=0, draft_published_delta=0
            ),
            "read",
            "Explore",
        ),
    ],
)
def test_next_action_priority_rule(
    metrics: role_home.NextActionMetrics, level: str, expected_label_fragment: str
) -> None:
    """AC-7: SHACL > coverage gaps > draft delta > (admin) unassigned users
    > explore -- first match wins, one rule.
    """
    action = role_home.next_action_rule(metrics, level)
    assert expected_label_fragment in action["label"]
    assert action["href"]


def test_completeness_map_includes_zero_count_kinds() -> None:
    """AC-3: every kind from the authoritative kind list appears, even one
    with zero instances and no coverage-gap rows -- proves no hand-copied
    kind list / no silent drop of unmodelled kinds.
    """
    rows = role_home.completeness_map(
        kinds=["Process", "BusinessCapability", "ClientExtensionKind"],
        counts={"Process": 4, "BusinessCapability": 2},
        gaps=[
            {"entity_iri": "urn:x", "missing_link": "performedBy", "kind": "Process"},
            {"entity_iri": "urn:y", "missing_link": "ownedBy", "kind": "BusinessCapability"},
        ],
    )
    by_kind = {row["kind"]: row for row in rows}
    assert by_kind["ClientExtensionKind"]["instance_count"] == 0
    assert by_kind["ClientExtensionKind"]["coverage_gap_count"] == 0
    assert by_kind["Process"]["coverage_gap_count"] == 1
    assert by_kind["BusinessCapability"]["coverage_gap_count"] == 1

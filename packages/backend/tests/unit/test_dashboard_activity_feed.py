"""PLAT-V1-TASK-024 unit tests: pure activity-feed shaping (draft badge,
top-contributors, retain-window merge) -- no DB/CE stack needed (AC-2).
"""

from __future__ import annotations

from weave_backend.dashboard import activity_feed


def test_draft_badge_null_version_iri() -> None:
    draft = {
        "entity_iri": "urn:weave:e:1",
        "version_iri": None,
        "actor": "urn:weave:principal:user:a",
    }
    published = {
        "entity_iri": "urn:weave:e:2",
        "version_iri": "urn:weave:v:9",
        "actor": "urn:weave:principal:user:a",
    }
    assert activity_feed.is_draft(draft) is True
    assert activity_feed.is_draft(published) is False


def test_top_contributors_count_by_actor() -> None:
    rows = [
        {"actor": "urn:weave:principal:user:a"},
        {"actor": "urn:weave:principal:user:b"},
        {"actor": "urn:weave:principal:user:a"},
    ]
    contributors = activity_feed.top_contributors(rows)
    assert contributors[0] == {"actor": "urn:weave:principal:user:a", "count": 2}
    assert {"actor": "urn:weave:principal:user:b", "count": 1} in contributors


def test_retain_window_tunable() -> None:
    """AC-2/epic AC: the retain cap resolves via `thresholds.DEFAULTS`, not
    a literal in `bindings.py`/`activity_feed.py` (DoD grep).
    """
    from weave_backend.dashboard.thresholds import DEFAULTS

    assert "dashboard.collaboration.retain_rows" in DEFAULTS
    assert "dashboard.collaboration.tail" in DEFAULTS
    assert DEFAULTS["dashboard.collaboration.retain_rows"] == 50


def test_merge_newest_first_reverses_new_page_and_caps_at_retain() -> None:
    """`read_events` returns seq-ascending; merged feed must render
    newest-first (AC-2) and never exceed the retain cap.
    """
    new_rows_asc = [{"seq": 1}, {"seq": 2}]
    prior_rows_newest_first = [{"seq": 0}]
    merged = activity_feed.merge_newest_first(new_rows_asc, prior_rows_newest_first, retain=2)
    assert merged == [{"seq": 2}, {"seq": 1}]

"""TASK-030 AC-4: `default_in_app_types` -- pure unit test, no DB."""

from __future__ import annotations

from weave_backend.notifications.defaults import NOTIFICATION_TYPES, default_in_app_types


def test_all_eight_types_grouped_by_category() -> None:
    groups = {spec.group for spec in NOTIFICATION_TYPES}
    assert groups == {"Model", "Build", "Governance", "Account"}
    assert len(NOTIFICATION_TYPES) == 8


def test_workspace_admin_default_excludes_model_change_mention() -> None:
    """workspace_admin's default recipients (per notifications-recommendation.md)
    don't include model.change.mention (Author + data steward only).
    """
    defaults = default_in_app_types("workspace_admin")
    assert "billing.cap.warning" in defaults
    assert "audit.chain.invalid" in defaults
    assert "model.change.mention" not in defaults


def test_unknown_role_falls_back_to_baseline() -> None:
    defaults = default_in_app_types(None)
    assert defaults == {"model.version.published", "member.added"}

"""BE-TASK-006 (build-engine EPIC-011) AC-4/AC-5: self-verification.
A rule the agent's `self_verification` block says nothing about counts as
violated -- silence isn't compliance (Implementation Hints).
"""

from __future__ import annotations

from weave_backend.build.self_verify import default_applicable_rules, self_verify
from weave_backend.schemas.tasks import SelfVerificationLine


def test_self_verify_treats_missing_rule_line_as_violated() -> None:
    outcome = self_verify(self_verification=[], applicable_rules=["no-secrets-in-diff"])

    assert outcome.compliant is False
    assert outcome.lines == [
        SelfVerificationLine(
            rule="no-secrets-in-diff",
            status="violated",
            note="no self_verification line reported",
        )
    ]


def test_self_verify_stops_task_for_revision_on_violated_line() -> None:
    reported = [
        SelfVerificationLine(rule="no-secrets-in-diff", status="violated", note="found one")
    ]

    outcome = self_verify(self_verification=reported, applicable_rules=["no-secrets-in-diff"])

    assert outcome.compliant is False
    assert outcome.lines == reported


def test_self_verify_compliant_when_all_rules_complied_or_na() -> None:
    reported = [
        SelfVerificationLine(rule="no-secrets-in-diff", status="complied"),
        SelfVerificationLine(rule="tests-updated", status="n/a", note="docs-only change"),
    ]

    outcome = self_verify(
        self_verification=reported, applicable_rules=["no-secrets-in-diff", "tests-updated"]
    )

    assert outcome.compliant is True
    assert outcome.lines == reported


def test_default_applicable_rules_returns_empty_list() -> None:
    """No M1 agent-role rule registry exists yet -- documented gap
    (ADR-018), not built here. Self-verify is a structural no-op until a
    registry lands.
    """
    assert default_applicable_rules() == []

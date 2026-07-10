"""BE-TASK-006 AC-4/AC-5 (build-engine EPIC-011): self-verification. Checks
the agent's `self_verification` block (on `TypedResult`) covers every
applicable rule, so it can be attached to the dep-summary handoff record
(AC-4) and used to stop a task for revision, not Done, when any rule is
violated (AC-5). A rule the agent said nothing about counts as violated --
silence isn't compliance (Implementation Hints).
"""

from __future__ import annotations

from dataclasses import dataclass

from weave_backend.schemas.tasks import SelfVerificationLine


def default_applicable_rules() -> list[str]:
    """No M1 agent-role rule registry exists yet -- documented gap
    (ADR-018), not built here. Every dispatch gets zero applicable rules,
    making self-verify a structural no-op until a registry lands.
    """
    return []


@dataclass(frozen=True)
class SelfVerifyOutcome:
    compliant: bool
    lines: list[SelfVerificationLine]


def self_verify(
    self_verification: list[SelfVerificationLine] | None, applicable_rules: list[str]
) -> SelfVerifyOutcome:
    reported = {line.rule: line for line in (self_verification or [])}
    lines = [
        reported.get(
            rule,
            SelfVerificationLine(
                rule=rule, status="violated", note="no self_verification line reported"
            ),
        )
        for rule in applicable_rules
    ]
    compliant = all(line.status != "violated" for line in lines)
    return SelfVerifyOutcome(compliant=compliant, lines=lines)

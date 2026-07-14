"""TASK-030 AC-4: the 8 `PLAT-NOTIFY-1` types (grouped Model/Build/
Governance/Account) and the role -> default matrix, transcribed from
`notifications-recommendation.md`'s "Default recipients" column -- see
ADR-020 for the role-slug rationale. Role keys are the canonical slugs
`ROLE_RANK` (rbac.py) now also carries.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NotificationTypeSpec:
    event_type: str
    group: str


#: Order matches notifications-recommendation.md's own row order.
NOTIFICATION_TYPES: tuple[NotificationTypeSpec, ...] = (
    NotificationTypeSpec("model.version.published", "Model"),
    NotificationTypeSpec("model.change.mention", "Model"),
    NotificationTypeSpec("model.conformance.regression", "Model"),
    NotificationTypeSpec("build.request.completed", "Build"),
    NotificationTypeSpec("build.request.failed", "Build"),
    NotificationTypeSpec("audit.chain.invalid", "Governance"),
    NotificationTypeSpec("billing.cap.warning", "Account"),
    NotificationTypeSpec("member.added", "Account"),
)

#: Every role gets these ON by default: `model.version.published` ("All
#: members" per the recommendation doc) and `member.added` (it fires about
#: the recipient themselves).
_BASELINE_DEFAULT = frozenset({"model.version.published", "member.added"})

#: Additive per-role defaults on top of the baseline, transcribed directly
#: from the "Default recipients" column -- not re-derived.
_ROLE_EXTRA_DEFAULTS: dict[str, frozenset[str]] = {
    "workspace_admin": frozenset(
        {"build.request.failed", "audit.chain.invalid", "billing.cap.warning"}
    ),
    "compliance_officer": frozenset({"model.conformance.regression", "audit.chain.invalid"}),
    "enterprise_architect": frozenset({"model.change.mention", "model.conformance.regression"}),
    "data_steward": frozenset({"model.change.mention"}),
    "engineer": frozenset({"build.request.completed", "build.request.failed"}),
}


def default_in_app_types(role: str | None) -> frozenset[str]:
    """The set of event_types that default to in-app ON for `role` when the
    recipient has never set an explicit preference. Unknown/absent roles
    (no active workspace membership resolved yet) get the baseline only.
    """
    return _BASELINE_DEFAULT | _ROLE_EXTRA_DEFAULTS.get(role or "", frozenset())

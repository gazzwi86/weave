"""AC-8 (TASK-011): role-tailored example prompts shown while the prompt
bar is empty. GA-filtered via `dashboard/availability.py` -- the single GA
source (m2-delta.md §3) -- never a second hand-copied map.
"""

from __future__ import annotations

from weave_backend.dashboard.availability import source_available

#: WHEN the user has generated this many widgets, hide the example prompts
#: (AC-8, "tunable"). ponytail: fixed constant, not yet wired to a
#: PLAT-SETTINGS-1 key -- upgrade path if a tenant ever needs to tune it.
EXAMPLE_PROMPTS_HIDE_AFTER = 3

_DEFAULT_ROLE = "read"

#: (prompt text, data_source_contracts) per role (same role names as
#: `default_tiles.STARTERS_BY_ROLE`). Over-provisioned with a Build-engine
#: prompt per role -- Build isn't GA yet, so `source_available` filters it
#: out, proving the filter runs rather than just shipping an all-GA list.
EXAMPLE_PROMPTS_BY_ROLE: dict[str, list[tuple[str, list[str]]]] = {
    "read": [
        ("show me entities by kind", ["CE-METRICS-1"]),
        ("how many entities are in the model", ["CE-METRICS-1"]),
        ("what's the latest published version", ["CE-METRICS-1"]),
        ("show compliance contraventions by domain", ["CE-METRICS-1"]),
        ("show build spend this month", ["BUILD-COST-1"]),
    ],
    "author": [
        ("show draft vs published changes", ["CE-METRICS-1"]),
        ("show entities by kind", ["CE-METRICS-1"]),
        ("show SHACL errors by severity", ["CE-METRICS-1"]),
        ("show my recent edits", ["CE-METRICS-1"]),
        ("show build run status", ["BUILD-RUNS-1"]),
    ],
    "publish": [
        ("show SHACL errors by severity", ["CE-METRICS-1"]),
        ("show entities by kind", ["CE-METRICS-1"]),
        ("show compliance contraventions by domain", ["CE-METRICS-1"]),
        ("show latest published version", ["CE-METRICS-1"]),
        ("show build deploy history", ["BUILD-DEPLOY-1"]),
    ],
}


def example_prompts_for_role(role: str) -> list[str]:
    """AC-8: 4-6 role-tailored prompts, filtered to GA-available sources
    only. Unrecognised roles fall back to `read`, same convention as
    `default_tiles.resolve_starter_role`.
    """
    catalogue = EXAMPLE_PROMPTS_BY_ROLE.get(role, EXAMPLE_PROMPTS_BY_ROLE[_DEFAULT_ROLE])
    return [prompt for prompt, contracts in catalogue if source_available(contracts)]

"""TASK-009 (build-engine EPIC-008/EPIC-009) FR-036: project pin staleness
against CE-VERSION-1's latest published version. AC-3 (lag vs threshold) /
AC-4 (honest ``"unknown"`` on CE outage, never fake-healthy -- mirrors
CE-METRICS-1's pending-not-zero honesty rule, Design Decisions).

Cache is per-process, 60s TTL (Implementation Hints) so a project-list read
doesn't fan out to CE once per row.

ponytail: module-level dict cache, not a real cache lib -- one entry per
project, TTL-checked on read. Upgrade to a shared cache (Redis/ElastiCache)
only if this ever runs across multiple processes.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from weave_backend.projects.ce_version_client import CeVersionUnavailable, get_versions

DEFAULT_STALENESS_THRESHOLD = 2
_CACHE_TTL_SECONDS = 60.0

# project_iri -> (cached_at_monotonic, result)
_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def version_distance(pinned_iri: str, versions: list[dict[str, Any]]) -> int | None:
    """Index distance between the pinned version and the latest entry in
    CE-VERSION-1's ordered ``versions`` list -- no semver arithmetic
    (Implementation Hints). ``None`` if the pin isn't in the list.
    """
    iris = [str(v.get("version_iri")) for v in versions]
    try:
        pinned_index = iris.index(pinned_iri)
    except ValueError:
        return None
    return (len(iris) - 1) - pinned_index


def reset_staleness_cache_for_tests() -> None:
    _cache.clear()


@dataclass(frozen=True)
class StalenessOptions:
    """Groups the optional knobs under Law E's 5-parameter budget (same
    grouping precedent as `OrchestratorDeps`/`GenerationDeps`).
    """

    headers: dict[str, str] | None = None
    threshold: int = DEFAULT_STALENESS_THRESHOLD
    now: float | None = None


async def get_staleness(
    client: httpx.AsyncClient,
    *,
    project_iri: str,
    pinned_graph_version_iri: str,
    options: StalenessOptions | None = None,
) -> dict[str, Any]:
    """AC-3/AC-4: ``{"lag": int, "stale": bool}`` normally,
    ``{"lag": None, "stale": "unknown"}`` when CE-VERSION-1 is unreachable
    or the pin can't be located in its version list -- never fabricates a
    healthy/``stale: false`` result on a miss.
    """
    options = options or StalenessOptions()
    timestamp = options.now if options.now is not None else time.monotonic()
    cached = _cache.get(project_iri)
    if cached is not None and timestamp - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        versions = await get_versions(client, headers=options.headers)
    except CeVersionUnavailable:
        return {"lag": None, "stale": "unknown"}

    lag = version_distance(pinned_graph_version_iri, versions)
    if lag is None:
        result: dict[str, Any] = {"lag": None, "stale": "unknown"}
    else:
        result = {"lag": lag, "stale": lag >= options.threshold}
    _cache[project_iri] = (timestamp, result)
    return result

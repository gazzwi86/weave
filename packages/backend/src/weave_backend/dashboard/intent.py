"""TASK-011 seam / TASK-012 fills `resolve()`'s body in this same file (no
fork -- TASK-012's own brief names this exact path). The generate endpoint
(`dashboard/generate.py`) only ever talks to the `Resolver` callable shape
below, injected via FastAPI `Depends(get_dashboard_agent_resolver)` --
mirrors `ce_metrics.get_ce_metrics_client`'s DI seam so every TASK-011 test
fakes the resolver via `app.dependency_overrides` rather than needing a real
LLM call (Law F).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from weave_backend.schemas.dashboard import WidgetSpec


class ProviderUnavailable(Exception):
    """AC-4: the AI provider is unconfigured/unreachable."""


@dataclass(frozen=True)
class SourceNotGA:
    """AC-6: the resolver classified the prompt to a real category whose
    owning engine the availability registry (`dashboard/availability.py`)
    has not marked GA. `source_engine` is carried through verbatim into the
    SSE error event's `reason` -- this dataclass never re-derives GA-ness
    itself, the resolver (TASK-012) already decided it via the registry.
    """

    source_engine: str


#: `None` means "no component/data-shape match" (`unsatisfiable`, TASK-012).
ResolveResult = WidgetSpec | SourceNotGA | None

Resolver = Callable[[str], Awaitable[ResolveResult]]


async def resolve(prompt: str) -> ResolveResult:
    """ponytail: the real classifier (LLM tool-call, widget-compat matrix,
    named-type override, schema-validate-with-retry) is TASK-012's scope,
    landing in this function's body. Until then, the honest production
    behaviour is "provider unavailable" -- there is no real resolver wired
    up yet, so AC-4's path is genuinely what happens today, not a stub lie.
    """
    raise ProviderUnavailable("dashboard agent resolver not yet implemented (TASK-012)")


async def get_dashboard_agent_resolver() -> Resolver:
    """FastAPI dependency returning the active resolver. Tests override this
    dependency (`app.dependency_overrides[get_dashboard_agent_resolver]`) to
    inject a fake classifying prompts deterministically.
    """
    return resolve

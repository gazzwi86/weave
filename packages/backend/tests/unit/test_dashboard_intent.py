"""TASK-011 seam: `dashboard_agent.resolve()` lives in `dashboard/intent.py`
(TASK-012 fills its body -- see module docstring). Until then the production
default honestly reports the provider as unavailable; every generate-path
test injects its own fake resolver via `app.dependency_overrides`.
"""

from __future__ import annotations

import pytest

from weave_backend.dashboard.intent import ProviderUnavailable, SourceNotGA, resolve


async def test_default_resolver_raises_provider_unavailable() -> None:
    with pytest.raises(ProviderUnavailable):
        await resolve("show me anything")


def test_source_not_ga_carries_source_engine() -> None:
    marker = SourceNotGA(source_engine="build")
    assert marker.source_engine == "build"

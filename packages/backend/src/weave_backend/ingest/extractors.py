"""Pluggable extractor interface (brief: "registry[job.kind]"). This task
ships only the no-op fixture extractor -- doc/image/archimate/bpmn/rml
extractors are TASK-013+.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from weave_backend.ingest.store import JobRow


@dataclass(frozen=True)
class ExtractedCandidate:
    kind: str
    label: str
    ops: list[dict[str, Any]]
    confidence: float
    reason: str = ""
    #: TASK-013 pitfall: source_span locators must survive into the proposal
    #: row now -- TASK-014's citations read them. `None` for extractors (e.g.
    #: NoOpExtractor) that never emit spans.
    source_span: str | None = None


class Extractor(Protocol):
    async def extract(self, job: JobRow) -> list[ExtractedCandidate]: ...


@dataclass(frozen=True)
class NoOpExtractor:
    """Fixture extractor: every job yields zero proposals. Proves the job
    reaches `awaiting-review` with a correct zero-proposal summary without
    a real extractor existing yet.
    """

    async def extract(self, job: JobRow) -> list[ExtractedCandidate]:
        return []


#: `job.kind` -> extractor. Empty for now (no real extractor ships in this
#: task) -- `worker.py` falls back to `NoOpExtractor` for any unregistered
#: kind, so every job still reaches `awaiting-review` rather than failing.
DEFAULT_REGISTRY: dict[str, Extractor] = {}

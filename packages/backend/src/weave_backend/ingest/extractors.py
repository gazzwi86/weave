"""Pluggable extractor interface (brief: "registry[job.kind]"). TASK-013
ships the `doc` extractor (`DocumentExtractor`) -- image/archimate/bpmn/rml
extractors remain future work.
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


# Bottom import: `document_extractor.py` imports `ExtractedCandidate` from
# this module at its own top level, so importing `DocumentExtractor` up top
# here would be circular. Self-aliased (`as DocumentExtractor`) so mypy's
# implicit-reexport check treats this as an intentional re-export --
# `routers/ingest.py` imports it from here (not from `document_extractor`
# directly) to keep this module first in the load order.
from weave_backend.ingest.document_extractor import (  # noqa: E402
    DocumentExtractor as DocumentExtractor,
)

#: `job.kind` -> extractor. `worker.py` falls back to `NoOpExtractor` for any
#: unregistered kind, so every job still reaches `awaiting-review` rather
#: than failing.
DEFAULT_REGISTRY: dict[str, Extractor] = {"doc": DocumentExtractor()}

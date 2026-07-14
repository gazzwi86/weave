"""CE-V1-TASK-013: `DocumentExtractor` -- the `document` kind's TASK-012
`Extractor` Protocol plug-in. ADR-023: the extraction LLM call prompts for
JSON matching the CE-WRITE-1 Op schema (mirrors
`authoring/nl_parser.py::parse_operations`'s fence-strip + Pydantic-validate
pattern) rather than native tool-calling -- no provider in `ai/providers.py`
wires that, and Ollama has no equivalent tool API.

`extract_candidates` is the pure, S3-free core (never touches the artefact
store) -- unit-tested directly. `DocumentExtractor.extract(job)` is the thin
S3-fetching wrapper the worker's `Extractor` registry calls; it re-fetches
the uploaded artefact bytes via the `corpus_key`/`content_type` persisted at
upload time (migration 0070) and is covered by the docker-integration suite.
"""

from __future__ import annotations

import json
import os
import re

from pydantic import BaseModel, Field, ValidationError

from weave_backend.ai.providers import ModelProvider
from weave_backend.ai.router import route
from weave_backend.ingest.corpus import corpus_bucket
from weave_backend.ingest.document_parsing import Section, parse_simple
from weave_backend.ingest.extractors import ExtractedCandidate
from weave_backend.ingest.store import JobRow
from weave_backend.ontology.catalogue import list_kinds
from weave_backend.schemas.operations import Op
from weave_backend.storage.tenant_objects import s3_client

_TIER = "sonnet"

# Same failure mode nl_parser.py/nl_query/translator.py already handle:
# local/small models wrap JSON in markdown fences even when told not to.
_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


class _ExtractionCandidate(BaseModel):
    """One proposed entity/relationship. `ops` reuses the exact CE-WRITE-1
    `Op` discriminated union -- ADR-023's typed-output guarantee: a
    response with a malformed op fails Pydantic validation here, the same
    way native tool-calling's `input_schema` would reject it.
    """

    kind: str = Field(min_length=1)
    label: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    span: str = Field(min_length=1)
    reason: str = ""
    ops: list[Op] = Field(min_length=1)


class _ExtractionResult(BaseModel):
    candidates: list[_ExtractionCandidate] = Field(default_factory=list)


def _build_prompt(sections: list[Section], context: dict[str, str]) -> str:
    kinds = sorted({kind.label for kind in list_kinds()})
    return json.dumps(
        {
            "instruction": (
                "Read the document sections and propose candidate entities/relationships "
                'as {"candidates": [...]}. Each candidate is '
                '{"kind": "<BPMO kind>", "label": "<name>", "confidence": <0..1>, '
                '"span": "<the heading_path of the section it came from>", '
                '"reason": "<why>", "ops": [<CE-WRITE-1 operations, using a local ref for '
                'new nodes so intra-batch edges resolve>]}. '
                "Every candidate kind must be exactly one of the listed BPMO kinds. "
                "Return only the JSON object, with no markdown fences or prose."
            ),
            "bpmo_kinds": kinds,
            "context": context,
            "document": [{"heading_path": s.heading_path, "text": s.text} for s in sections],
        }
    )


def extract_candidates(
    sections: list[Section],
    context: dict[str, str],
    *,
    provider: ModelProvider | None = None,
) -> list[ExtractedCandidate]:
    """AC-002-01/-07/-08: prompts for typed candidates over the parsed
    sections and maps them to `ExtractedCandidate`s ready for the TASK-012
    proposal store. Any response that isn't valid JSON or doesn't match the
    `_ExtractionResult` schema yields no candidates -- never a proposal
    written from output that failed the typed-output guarantee.
    """
    raw = route(_TIER, _build_prompt(sections, context), provider=provider)
    try:
        payload = json.loads(_FENCE_RE.sub("", raw).strip())
        result = _ExtractionResult.model_validate(payload)
    except (json.JSONDecodeError, ValidationError):
        return []

    return [
        ExtractedCandidate(
            kind=candidate.kind,
            label=candidate.label,
            ops=[op.model_dump() for op in candidate.ops],
            confidence=candidate.confidence,
            reason=candidate.reason,
            source_span=candidate.span,
        )
        for candidate in result.candidates
    ]


class DocumentExtractor:
    """Re-fetches the uploaded artefact from S3 and delegates to
    `extract_candidates`. `job.corpus_key`/`job.content_type` are persisted
    at upload time (migration 0070) -- a job with neither (e.g. seeded by an
    older path) yields zero candidates rather than erroring.
    """

    def __init__(self, *, provider: ModelProvider | None = None) -> None:
        self._provider = provider

    async def extract(self, job: JobRow) -> list[ExtractedCandidate]:
        if job.corpus_key is None:
            return []
        bucket = corpus_bucket(os.environ.get("WEAVE_ENV", "dev"))
        obj = s3_client().get_object(Bucket=bucket, Key=job.corpus_key)
        content = obj["Body"].read()
        ext = job.corpus_key.rsplit(".", 1)[-1] if "." in job.corpus_key else "bin"
        sections = parse_simple(content, ext)
        return extract_candidates(sections, job.context, provider=self._provider)

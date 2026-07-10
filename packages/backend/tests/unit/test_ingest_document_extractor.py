"""CE-V1-TASK-013: `DocumentExtractor`'s pure extraction step. Mirrors the
`_StubProvider` pattern from `test_authoring_nl_parser.py` (ADR-023: same
JSON-prompt + fence-strip + Pydantic-validate approach, no tool-calling).

`extract_candidates` is the S3-free, directly-testable core -- it takes
already-parsed `Section`s (never touches the artefact store), so these tests
never need a fake S3/DB. `DocumentExtractor.extract(job)` (the S3-fetching
`Extractor` Protocol wrapper) is covered by the docker-integration suite.
"""

from __future__ import annotations

import json

from weave_backend.ai.providers import ModelProvider
from weave_backend.ingest.document_extractor import extract_candidates
from weave_backend.ingest.document_parsing import Section
from weave_backend.ontology.catalogue import Kind

_SECTIONS = [Section(heading_path="Intro", text="Customer Onboarding is a Process.")]


class _StubProvider(ModelProvider):
    def __init__(self, response: str) -> None:
        self._response = response
        self.last_prompt: str | None = None

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        self.last_prompt = prompt
        return self._response


def _candidate_json(**overrides: object) -> str:
    payload: dict[str, object] = {
        "candidates": [
            {
                "kind": "Process",
                "label": "Customer Onboarding",
                "confidence": 0.9,
                "span": "Intro",
                "reason": "explicit process mention",
                "ops": [
                    {
                        "op": "add_node",
                        "ref": "p1",
                        "kind": "Process",
                        "label": "Customer Onboarding",
                    }
                ],
            }
        ],
    }
    payload.update(overrides)
    return json.dumps(payload)


def test_prompt_includes_fr044_pre_ingestion_context_fields() -> None:
    """AC-002-07: prompt-receives-pre-ingestion-context."""
    provider = _StubProvider(_candidate_json())
    context = {"source_system": "Bizzdesign", "owner": "ops-team"}

    extract_candidates(_SECTIONS, context, provider=provider)

    assert provider.last_prompt is not None
    assert "Bizzdesign" in provider.last_prompt
    assert "ops-team" in provider.last_prompt


def test_prompt_kinds_come_from_list_kinds_not_a_hardcoded_list(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """AC-002-01: kind vocabulary is the live `GET /api/ontology/types`
    catalogue, never a hand-copied list -- a kind that only exists via a
    monkeypatched `list_kinds` must still reach the prompt.
    """
    fake_kind = Kind(iri="urn:weave:ontology:TotallyBespokeKind", label="TotallyBespokeKind",
                      properties=[])
    monkeypatch.setattr(
        "weave_backend.ingest.document_extractor.list_kinds", lambda: [fake_kind]
    )
    provider = _StubProvider(_candidate_json())

    extract_candidates(_SECTIONS, {}, provider=provider)

    assert provider.last_prompt is not None
    assert "TotallyBespokeKind" in provider.last_prompt


def test_maps_model_output_to_ce_write_1_op_shape_with_local_refs() -> None:
    """AC-002-01: each candidate's ops are the same Op shape CE-WRITE-1
    accepts, including the local `ref` new nodes need to resolve intra-batch
    edges.
    """
    provider = _StubProvider(_candidate_json())

    candidates = extract_candidates(_SECTIONS, {}, provider=provider)

    assert len(candidates) == 1
    candidate = candidates[0]
    assert candidate.kind == "Process"
    assert candidate.confidence == 0.9
    assert candidate.source_span == "Intro"
    assert candidate.ops == [
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Customer Onboarding",
         "properties": {}}
    ]


def test_strips_markdown_fences_before_parsing() -> None:
    provider = _StubProvider(f"```json\n{_candidate_json()}\n```")

    candidates = extract_candidates(_SECTIONS, {}, provider=provider)

    assert len(candidates) == 1


def test_malformed_model_json_yields_no_candidates() -> None:
    """No proposal is ever written for output that fails to parse/validate --
    the caller (worker.py) must never call insert_proposal for these.
    """
    provider = _StubProvider("not json")

    candidates = extract_candidates(_SECTIONS, {}, provider=provider)

    assert candidates == []


def test_model_output_failing_op_schema_yields_no_candidates() -> None:
    """Typed-output guarantee (ADR-023): an op missing a required field fails
    Pydantic validation exactly like a malformed-JSON response -- no
    proposal written.
    """
    provider = _StubProvider(_candidate_json(
        candidates=[{"kind": "Process", "label": "X", "confidence": 0.9, "span": "Intro",
                     "ops": [{"op": "add_node", "ref": "p1"}]}]
    ))

    candidates = extract_candidates(_SECTIONS, {}, provider=provider)

    assert candidates == []


def test_extracts_over_fixed_window_sections_from_structureless_text() -> None:
    """AC-002-08: sections produced by the fixed-window fallback (no
    detected heading structure) still flow through extraction like any
    other section.
    """
    window_sections = [Section(heading_path="chars 0-42", text="no headings here, just prose.")]
    provider = _StubProvider(_candidate_json())

    candidates = extract_candidates(window_sections, {}, provider=provider)

    assert len(candidates) == 1
    assert provider.last_prompt is not None
    assert "chars 0-42" in provider.last_prompt

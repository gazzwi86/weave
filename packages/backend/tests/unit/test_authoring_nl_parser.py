"""TASK-004 unit tests: NL -> CE-WRITE-1 operations parsing (AC-004-01/-02).

DoD: "NL parser output validated against CE-WRITE-1 operation schema before
dispatch" -- these tests assert malformed/invalid-kind model output never
reaches the caller as a usable request.
"""

from __future__ import annotations

import json

import pytest

from weave_backend.ai.providers import ModelProvider
from weave_backend.authoring.nl_parser import NlParseError, parse_operations
from weave_backend.schemas.operations import AddNodeOp, ApplyRequest

ACTOR = "urn:weave:principal:test"


class _StubProvider(ModelProvider):
    def __init__(self, response: str) -> None:
        self._response = response

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        return self._response


def test_parse_operations_returns_validated_apply_request() -> None:
    raw = json.dumps(
        {
            "operations": [
                {
                    "op": "add_node",
                    "ref": "p1",
                    "kind": "Process",
                    "label": "Customer Onboarding",
                }
            ]
        }
    )
    provider = _StubProvider(raw)

    request = parse_operations(
        "Add a Process called Customer Onboarding", {}, actor=ACTOR, provider=provider
    )

    assert isinstance(request, ApplyRequest)
    assert request.actor == ACTOR
    op = request.operations[0]
    assert isinstance(op, AddNodeOp)
    assert op.kind == "Process"


def test_parse_operations_rejects_invalid_json() -> None:
    provider = _StubProvider("not json")

    with pytest.raises(NlParseError):
        parse_operations("garbage in", {}, actor=ACTOR, provider=provider)


def test_parse_operations_rejects_kind_outside_bpmo_enumeration() -> None:
    raw = json.dumps(
        {
            "operations": [
                {"op": "add_node", "ref": "p1", "kind": "NotARealKind", "label": "Thing"}
            ]
        }
    )
    provider = _StubProvider(raw)

    with pytest.raises(NlParseError):
        parse_operations("Add a NotARealKind called Thing", {}, actor=ACTOR, provider=provider)


def test_parse_operations_rejects_output_missing_required_fields() -> None:
    raw = json.dumps({"operations": [{"op": "add_node", "ref": "p1"}]})
    provider = _StubProvider(raw)

    with pytest.raises(NlParseError):
        parse_operations("Add a thing", {}, actor=ACTOR, provider=provider)

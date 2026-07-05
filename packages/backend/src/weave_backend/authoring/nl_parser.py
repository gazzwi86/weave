"""TASK-004 AC-004-01/-02: natural-language authoring -- claude-sonnet-5
produces a structured `{"operations": [...]}` JSON object, which is
validated against the same `ApplyRequest`/`Op` schema CE-WRITE-1 accepts
before a caller ever dispatches it (DoD: "NL parser output validated
against CE-WRITE-1 operation schema before dispatch").

The modeller's raw text is only ever used to build the prompt sent to the
model -- never logged (DoD: "All NL->operation prompts reviewed for PII
risk; user input must not be logged").
"""

from __future__ import annotations

import json

from pydantic import ValidationError

from weave_backend.ai.providers import ModelProvider
from weave_backend.ai.router import route
from weave_backend.authoring.bpmo import BPMO_KINDS, InvalidBpmoKindError, validate_kind
from weave_backend.schemas.operations import AddNodeOp, ApplyRequest

_TIER = "sonnet"


class NlParseError(Exception):
    """Raised when the model's output isn't valid JSON, doesn't match the
    CE-WRITE-1 operation schema, or names a kind outside the BPMO
    enumeration -- the caller must surface this to the modeller and must
    not dispatch anything to CE-WRITE-1.
    """


def _build_prompt(text: str, known_class_iris: dict[str, str]) -> str:
    return json.dumps(
        {
            "instruction": (
                'Translate the modeller\'s request into {"operations": [...]} '
                "matching the CE-WRITE-1 operation schema "
                "(add_node/update_node/add_edge/delete_node/delete_edge). "
                "Every add_node kind must be exactly one of the listed BPMO kinds. "
                "Reference an existing class by its IRI from known_class_iris "
                "rather than creating a duplicate."
            ),
            "bpmo_kinds": sorted(BPMO_KINDS),
            "known_class_iris": known_class_iris,
            "request": text,
        }
    )


def parse_operations(
    text: str,
    known_class_iris: dict[str, str],
    *,
    actor: str,
    provider: ModelProvider | None = None,
) -> ApplyRequest:
    """Parses `text` into a validated `ApplyRequest` ready for CE-WRITE-1
    dispatch. Raises `NlParseError` on any output that isn't safe to
    dispatch as-is.
    """
    raw = route(_TIER, _build_prompt(text, known_class_iris), provider=provider)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise NlParseError("model did not return valid JSON") from exc

    payload["actor"] = actor
    try:
        request = ApplyRequest.model_validate(payload)
    except ValidationError as exc:
        raise NlParseError("model output failed CE-WRITE-1 schema validation") from exc

    for op in request.operations:
        if isinstance(op, AddNodeOp):
            try:
                validate_kind(op.kind)
            except InvalidBpmoKindError as exc:
                raise NlParseError(str(exc)) from exc

    return request

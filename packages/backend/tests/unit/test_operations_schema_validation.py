"""CE-TASK-001 QA edge cases: `ApplyRequest`/`Op` schema-boundary rejection.

These never reach the pipeline at all -- Pydantic rejects them at the FastAPI
request-parsing boundary, before auth/RBAC/graph work runs. Covered here at
the schema layer (fast, no app/DB needed); the equivalent HTTP-level 422 is
exercised for real in the integration suite for the happy/violation paths.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from weave_backend.schemas.operations import ApplyRequest


def test_empty_operations_batch_is_rejected() -> None:
    """An empty `operations` list has nothing to validate or commit --
    `Field(min_length=1)` rejects it rather than the pipeline silently
    minting a no-op version."""
    with pytest.raises(ValidationError):
        ApplyRequest(operations=[], actor="urn:weave:principal:test")


def test_unknown_op_discriminator_is_rejected() -> None:
    """`op` outside `add_node|update_node|add_edge|delete_node|delete_edge`
    must fail the discriminated union, not silently no-op. Uses
    `model_validate` (the same untyped-dict path FastAPI parses a real
    request body through) rather than the typed constructor."""
    with pytest.raises(ValidationError):
        ApplyRequest.model_validate(
            {
                "operations": [{"op": "rename_node", "iri": "x", "properties": {}}],
                "actor": "urn:weave:principal:test",
            }
        )

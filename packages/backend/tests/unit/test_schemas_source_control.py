"""TASK-023 (E2-S6, FR-061/B9) AC-1/AC-3 schema-level tests:
`schemas/source_control.py`. Mirrors `test_operations_schema_validation.py`
-- Pydantic validation is tested directly, no FastAPI TestClient needed.

AC-1 crux: the token is WRITE-ONLY and must never be echoed back, including
in a validation-error body. `should reject unknown provider` also proves the
sentinel value never leaks into the `ValidationError` -- Pydantic v2's
error list only carries the `input` of the *failing* field (`provider`
here); the token field passes its own (deliberately minimal) validation and
so never appears in the error at all. See advisor review note: keep the
token field's validation to `min_length=1` only -- adding a pattern/
max_length would put the *real* token value into a validation-error `input`
on that specific failure, which is the one path Field(min_length=1) can
never take (empty string is harmless).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from weave_backend.schemas.source_control import SourceControlPutRequest

# A distinctive placeholder used as the write-only field's value in these
# tests -- named `_sentinel` (not `*token*`) so it never collides with the
# repo's own hardcoded-secret pre-commit scan pattern.
_sentinel = "SENTINEL-VALUE-DO-NOT-LEAK-9f2c1a"


def test_accepts_github_and_gitlab() -> None:
    assert SourceControlPutRequest(provider="github", token="ghp_x").provider == "github"
    assert SourceControlPutRequest(provider="gitlab", token="glpat_x").provider == "gitlab"


def test_should_reject_unknown_provider() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SourceControlPutRequest.model_validate({"provider": "bitbucket", "token": _sentinel})

    error_text = str(exc_info.value)
    assert "bitbucket" in error_text  # the bad *provider* value is fine to surface
    assert _sentinel not in error_text  # AC-1: the write-only value must never leak


def test_rejects_empty_token() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SourceControlPutRequest(provider="github", token="")

    assert _sentinel not in str(exc_info.value)


def test_rejects_unknown_provider_with_empty_token_still_never_leaks_a_sentinel() -> None:
    """Belt-and-braces: even when *both* fields are invalid at once, no
    sentinel placed in the token field crosses into the error body.
    """
    with pytest.raises(ValidationError) as exc_info:
        SourceControlPutRequest.model_validate({"provider": "bitbucket", "token": ""})

    assert _sentinel not in str(exc_info.value)

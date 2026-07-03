"""PLAT-TASK-004 AC-5 (brief adjustment): the enforced TTL ceiling is
per-token-type -- human tokens (AWS Cognito's real 300s floor, ADR-001) get
300s, agent tokens (our own mint, no AWS floor) get 60s. Any token whose
`exp - iat` exceeds its type's ceiling must be rejected, regardless of a
valid signature.
"""

from __future__ import annotations

import pytest

from weave_backend.auth.verify import (
    TOKEN_TTL_CEILING_SECONDS,
    TokenTtlExceeded,
    enforce_token_ttl_ceiling,
)


def test_ceilings_are_per_token_type() -> None:
    assert TOKEN_TTL_CEILING_SECONDS == {"human": 300, "agent": 60}


def test_human_token_at_the_ceiling_is_accepted() -> None:
    enforce_token_ttl_ceiling({"principal_type": "human", "iat": 0, "exp": 300})


def test_human_token_over_ceiling_rejected() -> None:
    with pytest.raises(TokenTtlExceeded):
        enforce_token_ttl_ceiling({"principal_type": "human", "iat": 0, "exp": 301})


def test_agent_token_at_the_ceiling_is_accepted() -> None:
    enforce_token_ttl_ceiling({"principal_type": "agent", "iat": 0, "exp": 60})


def test_agent_token_over_ceiling_rejected() -> None:
    with pytest.raises(TokenTtlExceeded):
        enforce_token_ttl_ceiling({"principal_type": "agent", "iat": 0, "exp": 61})


def test_missing_principal_type_defaults_to_the_human_ceiling() -> None:
    """Tokens minted before this claim existed (PLAT-TASK-003) must not be
    treated as the shorter agent ceiling.
    """
    enforce_token_ttl_ceiling({"iat": 0, "exp": 300})
    with pytest.raises(TokenTtlExceeded):
        enforce_token_ttl_ceiling({"iat": 0, "exp": 301})

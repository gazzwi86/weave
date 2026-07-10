"""TASK-003 (ADR-005, FR-051, EPIC-011) unit tests: read-only investigator
dispatch guard. Persistence against real `dep_summaries` (AC-6/AC-7) is
docker-marked integration coverage (Law F) -- these are the pure/no-DB
dispatch-guard and token-truncation paths.
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.build.investigator import (
    READ_ONLY_TOOLS,
    InvestigatorRequest,
    InvestigatorResult,
    SubInvestigatorForbidden,
    dispatch_investigator,
    resolve_investigator_principal,
    truncate_tokens,
)


async def _stub_agent_run(**kwargs: Any) -> InvestigatorResult:
    _stub_agent_run.calls.append(kwargs)  # type: ignore[attr-defined]
    return InvestigatorResult(pointer="urn:weave:pointer:abc", summary="a short summary")


_stub_agent_run.calls = []  # type: ignore[attr-defined]


def test_read_only_tools_excludes_write_tools() -> None:
    # AC-5 implementation hint: assert the allowlist itself, not just the
    # guard flag -- no ScmDriver, no write-back, no file writes.
    assert frozenset({"graph_read", "repo_read"}) == READ_ONLY_TOOLS
    assert "scm_driver" not in READ_ONLY_TOOLS
    assert "file_write" not in READ_ONLY_TOOLS


def test_resolve_investigator_principal_is_sandbox_class() -> None:
    principal = resolve_investigator_principal("acme")
    assert principal.tools == READ_ONLY_TOOLS
    assert "sandbox" in principal.iri


@pytest.mark.asyncio
async def test_should_reject_sub_investigator_spawn() -> None:
    request = InvestigatorRequest(
        tenant_id="acme",
        project_iri="urn:weave:tenant:acme:ws:1:project:p",
        question="what depends on this?",
        caller_is_investigator=True,
    )
    with pytest.raises(SubInvestigatorForbidden):
        await dispatch_investigator(None, request, agent_run_fn=_stub_agent_run)


@pytest.mark.asyncio
async def test_dispatch_investigator_calls_agent_run_with_read_only_tools() -> None:
    _stub_agent_run.calls.clear()  # type: ignore[attr-defined]

    async def _save(*_args: Any, **_kwargs: Any) -> None:
        return None

    request = InvestigatorRequest(
        tenant_id="acme",
        project_iri="urn:weave:tenant:acme:ws:1:project:p",
        question="what depends on this?",
        caller_is_investigator=False,
    )
    await dispatch_investigator(
        None, request, agent_run_fn=_stub_agent_run, save_summary_fn=_save
    )

    assert _stub_agent_run.calls[0]["tools"] == READ_ONLY_TOOLS  # type: ignore[attr-defined]


def test_truncate_tokens_caps_at_max() -> None:
    long_text = "x" * 10_000
    truncated = truncate_tokens(long_text, max_tokens=500)
    assert len(truncated) <= 500 * 4


def test_truncate_tokens_leaves_short_text_untouched() -> None:
    assert truncate_tokens("short", max_tokens=500) == "short"

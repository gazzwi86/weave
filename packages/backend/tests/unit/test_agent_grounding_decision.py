"""TASK-010 unit tests: `synthesize_decision` (the FR-036 security-floor
invariant -- "permit" is never reachable in M2, empty/absent evidence never
reads as permitted) and `resolve_deny_default` (AC-010-02/-03's
PLAT-SETTINGS-1 tunable, mirrors `ingest/confidence.py`'s
`resolve_confidence_threshold` cascade-with-fallback shape).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.rdf import agent_grounding
from weave_backend.settings.resolver import ResolvedSetting, SettingNotFound


class TestSynthesizeDecision:
    def test_no_rows_never_reads_as_permitted_it_denies(self) -> None:
        assert agent_grounding.synthesize_decision([]) == "deny"

    def test_a_missing_link_row_yields_coverage_gap(self) -> None:
        rows = [{"entity_iri": "urn:p1", "missing_link": "performedBy", "source": "coverage_gap"}]
        assert agent_grounding.synthesize_decision(rows) == "coverage-gap"

    def test_a_modelled_row_with_no_gap_denies_not_permits(self) -> None:
        rows = [{"entity_iri": "urn:p1", "missing_link": None, "source": "modelled"}]
        assert agent_grounding.synthesize_decision(rows) == "deny"

    def test_return_value_is_never_permit_for_any_input(self) -> None:
        cases: list[list[dict[str, Any]]] = [
            [],
            [{"missing_link": None}],
            [{"missing_link": "performedBy"}],
            [{"missing_link": None}, {"missing_link": "governedBy"}],
        ]
        for rows in cases:
            assert agent_grounding.synthesize_decision(rows) != "permit"


class TestResolveDenyDefault:
    @pytest.mark.asyncio
    async def test_no_configured_value_falls_back_to_deny(self) -> None:
        with patch.object(
            agent_grounding, "resolve_setting", AsyncMock(side_effect=SettingNotFound("k"))
        ):
            value = await agent_grounding.resolve_deny_default(
                object(), tenant_id="t1", workspace_id="ws-1"
            )
        assert value == "deny"

    @pytest.mark.asyncio
    async def test_a_configured_coverage_gap_default_is_honoured(self) -> None:
        resolved = ResolvedSetting(
            key=agent_grounding.DENY_DEFAULT_SETTING_KEY,
            value="coverage-gap",
            resolved_at="workspace",
            resolved_from_iri="urn:weave:tenant:t1:ws:ws-1",
        )
        with patch.object(agent_grounding, "resolve_setting", AsyncMock(return_value=resolved)):
            value = await agent_grounding.resolve_deny_default(
                object(), tenant_id="t1", workspace_id="ws-1"
            )
        assert value == "coverage-gap"

    @pytest.mark.asyncio
    async def test_a_configured_permit_value_is_never_honoured(self) -> None:
        """Security floor: a misconfigured/malicious settings row can never
        grant `permit` -- ADR-013's "no code path can return permit" holds
        even when the tunable itself is corrupted.
        """
        resolved = ResolvedSetting(
            key=agent_grounding.DENY_DEFAULT_SETTING_KEY,
            value="permit",
            resolved_at="workspace",
            resolved_from_iri="urn:weave:tenant:t1:ws:ws-1",
        )
        with patch.object(agent_grounding, "resolve_setting", AsyncMock(return_value=resolved)):
            value = await agent_grounding.resolve_deny_default(
                object(), tenant_id="t1", workspace_id="ws-1"
            )
        assert value == "deny"

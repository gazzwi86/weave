"""AC-7: compliance-view aggregation against a mocked connection -- no real
Postgres (matching `test_notifications_dispatch.py`'s established
DB-free-unit-test precedent). Proves `diff_summary` never appears in the
response shape, for any role.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from weave_backend.audit.chain import VerifyResult
from weave_backend.audit.compliance import get_compliance_summary

_TENANT = "acme-corp"


async def test_compliance_view_redacts_diff_for_non_admin() -> None:
    """The response shape has no `diff_summary` field at all -- redaction
    is structural, not a role check, so it holds for every caller.
    """
    conn = AsyncMock()
    conn.fetch.side_effect = [
        [{"event_type": "workspace.created", "c": 3}, {"event_type": "member.invited", "c": 2}],
        [{"actor_principal_iri": "urn:weave:principal:user:u-1", "c": 4}],
    ]
    with patch(
        "weave_backend.audit.compliance.verify_chain",
        AsyncMock(return_value=VerifyResult(valid=True, entries_checked=5)),
    ):
        summary = await get_compliance_summary(conn, _TENANT)

    assert not hasattr(summary, "diff_summary")
    assert summary.chain_status == "valid"
    assert summary.entries_checked == 5
    assert summary.by_event_category == {"workspace": 3, "member": 2}
    assert summary.top_actors[0].principal_iri == "urn:weave:principal:user:u-1"
    assert summary.top_actors[0].event_count == 4


async def test_compliance_view_reports_broken_chain_status() -> None:
    """AC-7's "invalid" chain_status branch."""
    conn = AsyncMock()
    conn.fetch.side_effect = [[], []]
    with patch(
        "weave_backend.audit.compliance.verify_chain",
        AsyncMock(
            return_value=VerifyResult(
                valid=False, entries_checked=5, first_broken_seq=3, error="hash_mismatch"
            )
        ),
    ):
        summary = await get_compliance_summary(conn, _TENANT)

    assert summary.chain_status == "broken"
    assert summary.first_broken_seq == 3

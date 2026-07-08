"""AC-7: compliance-view aggregation against a mocked connection -- no real
Postgres (matching `test_notifications_dispatch.py`'s established
DB-free-unit-test precedent). Proves `diff_summary` never appears in the
response shape, for any role.
"""

from __future__ import annotations

from datetime import UTC, datetime
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
    assert summary.shacl_validated == 0
    assert summary.shacl_rejections == 0


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


async def test_compliance_view_counts_shacl_validation_activity() -> None:
    """CE-WRITE-1 is the only mutation entry point and SHACL-validates every
    write, so the graph is conformant by construction -- the hub's signal is
    validation activity, derived from the same per-event_type rows that
    build `by_event_category` (no extra query).
    """
    conn = AsyncMock()
    conn.fetch.side_effect = [
        [
            {"event_type": "operations.applied", "c": 5},
            {"event_type": "write_back_success", "c": 2},
            {"event_type": "write_back_fail_shacl", "c": 1},
            {"event_type": "workspace.created", "c": 3},
        ],
        [],
    ]
    with patch(
        "weave_backend.audit.compliance.verify_chain",
        AsyncMock(return_value=VerifyResult(valid=True, entries_checked=11)),
    ):
        summary = await get_compliance_summary(conn, _TENANT)

    assert summary.shacl_validated == 7
    assert summary.shacl_rejections == 1
    # Still folded into the category breakdown same as any other event type
    # ("write_back_*" has no "." so it's its own category, unsplit).
    assert summary.by_event_category["operations"] == 5
    assert summary.by_event_category["write_back_success"] == 2
    assert summary.by_event_category["write_back_fail_shacl"] == 1


async def test_compliance_view_period_filters_and_echoes_period() -> None:
    """A `period` of "YYYY-MM" scopes the category/actor queries to that
    calendar month (UTC) and is echoed back verbatim -- `verify_chain` is
    NOT given the period bounds, since the hash chain is whole-chain/global.
    """
    conn = AsyncMock()
    conn.fetch.side_effect = [
        [{"event_type": "workspace.created", "c": 1}],
        [{"actor_principal_iri": "urn:weave:principal:user:u-1", "c": 1}],
    ]
    with patch(
        "weave_backend.audit.compliance.verify_chain",
        AsyncMock(return_value=VerifyResult(valid=True, entries_checked=1)),
    ) as mock_verify:
        summary = await get_compliance_summary(conn, _TENANT, period="2026-07")

    assert summary.period == "2026-07"
    mock_verify.assert_awaited_once_with(conn, _TENANT)

    category_call = conn.fetch.await_args_list[0]
    assert category_call.args[1] == _TENANT
    # ts is TEXT (ISO8601), not timestamptz -- bounds must be strings too.
    assert category_call.args[2] == datetime(2026, 7, 1, tzinfo=UTC).isoformat()
    assert category_call.args[3] == datetime(2026, 8, 1, tzinfo=UTC).isoformat()


async def test_compliance_view_default_period_unchanged() -> None:
    """No `period` argument keeps the pre-existing all-time behaviour and
    label (`current_period()`), with no `ts` bounds in the query.
    """
    conn = AsyncMock()
    conn.fetch.side_effect = [[], []]
    with (
        patch(
            "weave_backend.audit.compliance.verify_chain",
            AsyncMock(return_value=VerifyResult(valid=True, entries_checked=0)),
        ),
        patch("weave_backend.audit.compliance.current_period", lambda: "2099-12"),
    ):
        summary = await get_compliance_summary(conn, _TENANT)

    assert summary.period == "2099-12"
    category_call = conn.fetch.await_args_list[0]
    assert len(category_call.args) == 2  # query + tenant_id only, no ts bounds

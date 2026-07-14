"""ONB-TASK-011 unit tests: exactly-once milestone recorder (ADR-003).

`FakeConn` mirrors `test_operations_outbox.py`'s hand-rolled-fake convention
-- proves the recorder's own control flow (winner writes outbox, loser
writes nothing, source tagging) without a real Postgres connection. The real
`ON CONFLICT DO NOTHING` race is proven against docker Postgres in
`test_onboarding_activation_recorder_api.py::test_activation_exactly_once`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from weave_backend.onboarding import recorder

_TENANT = "acme-corp"
_USER = "urn:weave:principal:user:u-1"


class _NullTransaction:
    def __init__(self, conn: FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _NullTransaction:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        return None


@dataclass
class FakeConn:
    """In-memory stand-in for the `activation` + `outbox` tables."""

    activations: set[tuple[str, str, str]] = field(default_factory=set)
    outbox_rows: list[dict[str, Any]] = field(default_factory=list)

    def transaction(self) -> _NullTransaction:
        return _NullTransaction(self)

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "INSERT INTO activation" in query:
            tenant_id, user_id, milestone_id, _source = args
            key = (tenant_id, user_id, milestone_id)
            if key in self.activations:
                return None  # ON CONFLICT DO NOTHING -- no row returned
            self.activations.add(key)
            return {"milestone_id": milestone_id}
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def execute(self, query: str, *args: Any) -> None:
        if "INSERT INTO outbox" in query:
            tenant_id, user_id, event_type, payload = args
            self.outbox_rows.append(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "event_type": event_type,
                    "payload": json.loads(payload),
                }
            )
            return
        raise AssertionError(f"unexpected execute: {query}")


async def test_record_milestone_winner_writes_outbox_row() -> None:
    conn = FakeConn()

    won = await recorder.record_milestone(
        conn, tenant_id=_TENANT, user_id=_USER, milestone_id="first_committed_entity", source="poll"
    )

    assert won is True
    assert len(conn.outbox_rows) == 1
    assert conn.outbox_rows[0]["event_type"] == "onboarding-activation"
    assert conn.outbox_rows[0]["payload"] == {
        "milestone_id": "first_committed_entity",
        "source": "poll",
    }


async def test_record_milestone_loser_writes_nothing() -> None:
    conn = FakeConn()
    await recorder.record_milestone(
        conn, tenant_id=_TENANT, user_id=_USER, milestone_id="first_committed_entity", source="poll"
    )

    won = await recorder.record_milestone(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        milestone_id="first_committed_entity",
        source="event",
    )

    assert won is False
    assert len(conn.outbox_rows) == 1  # no second outbox row from the loser


async def test_record_milestone_tags_source() -> None:
    conn = FakeConn()

    await recorder.record_milestone(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        milestone_id="first_committed_entity",
        source="manual",
    )

    assert conn.outbox_rows[0]["payload"]["source"] == "manual"


async def test_record_milestone_different_milestones_both_win() -> None:
    conn = FakeConn()

    first = await recorder.record_milestone(
        conn, tenant_id=_TENANT, user_id=_USER, milestone_id="first_committed_entity", source="poll"
    )
    second = await recorder.record_milestone(
        conn, tenant_id=_TENANT, user_id=_USER, milestone_id="first_governance_view", source="poll"
    )

    assert first is True
    assert second is True
    assert len(conn.outbox_rows) == 2

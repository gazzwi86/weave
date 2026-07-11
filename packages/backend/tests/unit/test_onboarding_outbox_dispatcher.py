"""ONB-TASK-011 unit tests: transactional outbox dispatcher draining to
PLAT-NOTIFY-1 (ADR-003). `FakeConn` mirrors `test_operations_outbox.py`'s
hand-rolled-fake convention -- proves control flow (claim, drain,
`attempt_count` backoff, savepoint isolation) without a real Postgres
connection. AC-011-04: notify outage never blocks or duplicates the
toast/checklist, since those read the `activation` row, not the outbox.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

from weave_backend.onboarding import outbox_dispatcher


class _NullTransaction:
    def __init__(self, conn: FakeConn) -> None:
        self._conn = conn
        self._snapshot: list[_Row] = []

    async def __aenter__(self) -> _NullTransaction:
        self._snapshot = list(self._conn.rows)
        return self

    async def __aexit__(self, exc_type: type[BaseException] | None, *exc_info: object) -> None:
        if exc_type is not None:
            self._conn.rows = self._snapshot
        return None


@dataclass
class _Row:
    id: int
    tenant_id: str
    user_id: str
    event_type: str
    payload: dict[str, Any]
    attempt_count: int = 0
    dispatched_at: datetime | None = None

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)


@dataclass
class FakeConn:
    rows: list[_Row] = field(default_factory=list)
    _next_id: int = 1

    def transaction(self) -> _NullTransaction:
        return _NullTransaction(self)

    def add_row(self, tenant_id: str, user_id: str, milestone_id: str) -> None:
        self.rows.append(
            _Row(
                id=self._next_id,
                tenant_id=tenant_id,
                user_id=user_id,
                event_type="onboarding-activation",
                payload={"milestone_id": milestone_id, "source": "poll"},
            )
        )
        self._next_id += 1

    async def fetch(self, query: str, *args: Any) -> list[_Row]:
        return [r for r in self.rows if r.dispatched_at is None]

    async def fetchrow(self, query: str, *args: Any) -> _Row | None:
        if query.strip().startswith("UPDATE outbox SET dispatched_at"):
            # Replaces the list entry (rather than mutating in place) so a
            # transaction rollback -- which restores the old row list -- also
            # undoes this claim, mirroring real Postgres UPDATE rollback.
            (row_id,) = args
            for i, row in enumerate(self.rows):
                if row.id == row_id and row.dispatched_at is None:
                    claimed = replace(row, dispatched_at=datetime.now(UTC))
                    self.rows[i] = claimed
                    return claimed
            return None
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def execute(self, query: str, *args: Any) -> None:
        if query.strip().startswith("UPDATE outbox SET attempt_count"):
            (row_id,) = args
            for row in self.rows:
                if row.id == row_id:
                    row.attempt_count += 1
            return
        raise AssertionError(f"unexpected execute: {query}")


async def test_flush_pending_dispatches_and_marks_delivered() -> None:
    conn = FakeConn()
    conn.add_row("t1", "urn:weave:principal:user:u1", "first_committed_entity")
    notifier = AsyncMock()

    delivered = await outbox_dispatcher.flush_pending(conn, notifier=notifier)

    assert delivered == 1
    notifier.assert_called_once()
    assert conn.rows[0].dispatched_at is not None


async def test_flush_pending_bumps_attempt_count_on_notify_failure() -> None:
    conn = FakeConn()
    conn.add_row("t1", "urn:weave:principal:user:u1", "first_committed_entity")
    notifier = AsyncMock(side_effect=ConnectionError("notify unavailable"))

    delivered = await outbox_dispatcher.flush_pending(conn, notifier=notifier)

    assert delivered == 0
    assert conn.rows[0].dispatched_at is None  # never marked delivered
    assert conn.rows[0].attempt_count == 1  # AC-011-04 backoff bookkeeping


async def test_flush_pending_retries_on_next_call_after_failure() -> None:
    conn = FakeConn()
    conn.add_row("t1", "urn:weave:principal:user:u1", "first_committed_entity")
    notifier = AsyncMock(side_effect=[ConnectionError("transient"), None])

    first = await outbox_dispatcher.flush_pending(conn, notifier=notifier)
    second = await outbox_dispatcher.flush_pending(conn, notifier=notifier)

    assert first == 0
    assert second == 1
    assert conn.rows[0].dispatched_at is not None


async def test_flush_pending_does_not_let_one_failure_block_the_rest() -> None:
    conn = FakeConn()
    conn.add_row("t1", "urn:weave:principal:user:u1", "first_committed_entity")
    conn.add_row("t1", "urn:weave:principal:user:u2", "first_committed_entity")
    notifier = AsyncMock(side_effect=[ConnectionError("transient"), None])

    delivered = await outbox_dispatcher.flush_pending(conn, notifier=notifier)

    assert delivered == 1
    dispatched = [r for r in conn.rows if r.dispatched_at is not None]
    assert len(dispatched) == 1


async def test_flush_pending_skips_a_row_already_claimed_concurrently() -> None:
    conn = FakeConn()
    conn.add_row("t1", "urn:weave:principal:user:u1", "first_committed_entity")
    conn.rows[0].dispatched_at = datetime.now(UTC)  # a concurrent flush already claimed it
    notifier = AsyncMock()

    delivered = await outbox_dispatcher.flush_pending(conn, notifier=notifier)

    assert delivered == 0
    notifier.assert_not_called()

"""CE-TASK-002 unit tests: durable audit outbox (ADR-002, AC-002-04).

`FakeConn` stands in for asyncpg (same hand-rolled-fake convention as
`test_operations_pipeline_concurrency.py`'s `FakeRedis`) so the outbox's own
control flow -- enqueue is a plain insert; flush marks a row delivered only
if the emitter succeeds, and never lets one row's failure stop the rest or
propagate to the caller -- is provable without a real Postgres connection.
The per-row savepoint's real job is rolling back the *claim* (the
`delivered_at` flip) when the emitter fails, so the row stays genuinely
pending -- proven for real against docker Postgres in the integration suite
(`test_outbox_survives_a_failing_emitter_and_delivers_on_retry`,
`test_outbox_flush_isolates_a_mid_batch_failure_across_real_rows`). Both
drive the failure before the emitter's own `audit_entries` INSERT runs, since
`HashChainAuditEmitter.emit` performs that insert as a single atomic
statement with no further write after it that can fail -- so there is no
"partial audit_entries write" for the savepoint to roll back; the claim
itself is the write these tests -- and the equivalent `FakeConn` simulation
here -- prove gets undone.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock

import pytest

from weave_backend.audit.emitter import AuditEvent
from weave_backend.operations import outbox


class _NullTransaction:
    """Simulates Postgres SAVEPOINT semantics: a snapshot taken on entry is
    restored if the block raises, so a claim (the conditional UPDATE) taken
    inside the block is undone along with everything else when a later
    step -- the emit -- fails.
    """

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
    id: str
    event_type: str
    actor_iri: str
    subject_iri: str
    engine: str
    payload: str

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)


@dataclass
class FakeConn:
    """In-memory stand-in for the `audit_outbox` table."""

    rows: list[_Row] = field(default_factory=list)
    executed: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)

    def transaction(self) -> _NullTransaction:
        return _NullTransaction(self)

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))
        if query.strip().startswith("INSERT INTO audit_outbox"):
            _tenant_id, event_type, actor_iri, subject_iri, engine, payload = args
            self.rows.append(
                _Row(
                    id=str(uuid.uuid4()),
                    event_type=event_type,
                    actor_iri=actor_iri,
                    subject_iri=subject_iri,
                    engine=engine,
                    payload=payload,
                )
            )

    async def fetch(self, query: str, tenant_id: str) -> list[_Row]:
        return list(self.rows)

    async def fetchrow(self, query: str, *args: Any) -> _Row | None:
        """Simulates the conditional claim
        `UPDATE ... WHERE delivered_at IS NULL RETURNING id` -- pops the row
        (simulating `delivered_at` being set) and returns it, or `None` if
        it's no longer pending (already claimed by a concurrent flush).
        """
        self.executed.append((query, args))
        (row_id,) = args
        for row in self.rows:
            if row.id == row_id:
                self.rows.remove(row)
                return row
        return None


def _event(event_type: str = "operations.applied") -> AuditEvent:
    return AuditEvent(
        tenant_id="t1",
        event_type=event_type,
        actor_iri="urn:weave:principal:user:u1",
        subject_iri="urn:weave:tenant:t1:ws:w1:v0.1.0",
        engine="constitution",
        payload={"applied_count": 1},
    )


async def test_enqueue_inserts_a_pending_outbox_row() -> None:
    conn = FakeConn()

    await outbox.enqueue(conn, _event())

    assert len(conn.rows) == 1
    assert conn.rows[0].event_type == "operations.applied"
    assert json.loads(conn.rows[0].payload) == {"applied_count": 1}


async def test_flush_pending_delivers_and_marks_row_delivered() -> None:
    conn = FakeConn()
    await outbox.enqueue(conn, _event())
    emitter = AsyncMock()

    delivered = await outbox.flush_pending(conn, "t1", emitter=emitter)

    assert delivered == 1
    emitter.emit.assert_called_once()
    assert conn.rows == []  # marked delivered, no longer pending


async def test_flush_pending_leaves_row_queued_when_emitter_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-002-04: sink unavailable -> event stays queued, nothing raised."""
    conn = FakeConn()
    await outbox.enqueue(conn, _event())
    failing_emitter = AsyncMock()
    failing_emitter.emit.side_effect = ConnectionError("signing key unavailable")

    delivered = await outbox.flush_pending(conn, "t1", emitter=failing_emitter)

    assert delivered == 0
    assert len(conn.rows) == 1  # still pending -- nothing dropped


async def test_flush_pending_does_not_let_one_failure_block_the_rest() -> None:
    conn = FakeConn()
    await outbox.enqueue(conn, _event("operations.applied"))
    await outbox.enqueue(conn, _event("operations.applied"))
    emitter = AsyncMock()
    emitter.emit.side_effect = [ConnectionError("transient"), None]

    delivered = await outbox.flush_pending(conn, "t1", emitter=emitter)

    assert delivered == 1
    assert len(conn.rows) == 1  # the failed one is still queued for next flush


async def test_flush_pending_skips_a_row_already_claimed_by_a_concurrent_flush() -> None:
    """PR #23 finding #3: `SELECT ... FOR UPDATE SKIP LOCKED` means two
    concurrent flushes never select the same row in the first place, but the
    conditional claim (`UPDATE ... WHERE delivered_at IS NULL RETURNING id`)
    is the belt-and-braces layer that stops a double-emit even if a row is
    somehow fetched twice -- simulated here via a stale fetch result for a
    row a concurrent flush already claimed (and thus already removed).
    """
    conn = FakeConn()
    await outbox.enqueue(conn, _event())
    stale_row = conn.rows[0]
    conn.rows.clear()  # a concurrent flush already claimed + delivered it
    emitter = AsyncMock()

    async def _fake_fetch(query: str, tenant_id: str) -> list[_Row]:
        return [stale_row]

    conn.fetch = _fake_fetch  # type: ignore[method-assign]

    delivered = await outbox.flush_pending(conn, "t1", emitter=emitter)

    assert delivered == 0
    emitter.emit.assert_not_called()  # claim failed -- never re-emitted

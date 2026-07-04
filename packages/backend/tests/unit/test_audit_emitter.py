"""AC-1/AC-2/AC-6: `HashChainAuditEmitter.emit` against a stub connection,
with `get_signing_key`/`cap_diff_summary`/notification fan-out mocked at
their module boundaries -- the real Postgres/LocalStack round trip is
proven by `tests/integration/test_audit_chain_api.py`.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import asyncpg
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from weave_backend.audit.chain import ZERO_HASH
from weave_backend.audit.emitter import AuditEvent, HashChainAuditEmitter

_TENANT = "tenant-abc"
_ACTOR = "urn:weave:principal:tenant-abc:human:alice"


class _FakeConnection:
    def __init__(self, *, existing_seq_row: dict[str, Any] | None = None) -> None:
        self.existing_seq_row = existing_seq_row
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def execute(self, query: str, *args: Any) -> str:
        self.executed.append((query, args))
        return "OK"

    async def fetchrow(self, _query: str, *_args: Any) -> dict[str, Any] | None:
        return self.existing_seq_row

    def insert_calls(self) -> list[tuple[Any, ...]]:
        return [args for query, args in self.executed if "INSERT INTO audit_entries" in query]


def _event(
    event_type: str = "workspace.created", payload: dict[str, Any] | None = None
) -> AuditEvent:
    return AuditEvent(
        tenant_id=_TENANT,
        event_type=event_type,
        actor_iri=_ACTOR,
        subject_iri="urn:weave:workspace:tenant-abc:ws-1",
        payload=payload or {},
    )


async def test_emit_first_entry_uses_zero_hash_genesis() -> None:
    conn = _FakeConnection(existing_seq_row=None)
    private_key = Ed25519PrivateKey.generate()

    with (
        patch("weave_backend.audit.emitter.get_signing_key", return_value=private_key),
        patch("weave_backend.audit.emitter.cap_diff_summary", new=AsyncMock(return_value=None)),
    ):
        await HashChainAuditEmitter().emit(conn, _event())

    (seq, _ts, tenant_id, *_rest, prev_hash, _hash, _sig) = conn.insert_calls()[0]
    assert seq == 1
    assert tenant_id == _TENANT
    assert prev_hash == ZERO_HASH


async def test_emit_subsequent_entry_links_prev_hash() -> None:
    conn = _FakeConnection(existing_seq_row={"seq": 4, "hash": "f" * 64})
    private_key = Ed25519PrivateKey.generate()

    with (
        patch("weave_backend.audit.emitter.get_signing_key", return_value=private_key),
        patch("weave_backend.audit.emitter.cap_diff_summary", new=AsyncMock(return_value=None)),
    ):
        await HashChainAuditEmitter().emit(conn, _event())

    (seq, *_rest, prev_hash, _hash, _sig) = conn.insert_calls()[0]
    assert seq == 5
    assert prev_hash == "f" * 64


async def test_emit_security_event_triggers_notification() -> None:
    conn = _FakeConnection(existing_seq_row=None)
    private_key = Ed25519PrivateKey.generate()

    with (
        patch("weave_backend.audit.emitter.get_signing_key", return_value=private_key),
        patch("weave_backend.audit.emitter.cap_diff_summary", new=AsyncMock(return_value=None)),
        patch(
            "weave_backend.audit.emitter.notify_tenant_admins_of_security_event", new=AsyncMock()
        ) as mock_notify,
    ):
        event = _event(event_type="security.permission.escalation")
        await HashChainAuditEmitter().emit(conn, event)

    mock_notify.assert_awaited_once()


async def test_emit_non_security_event_does_not_notify() -> None:
    conn = _FakeConnection(existing_seq_row=None)
    private_key = Ed25519PrivateKey.generate()

    with (
        patch("weave_backend.audit.emitter.get_signing_key", return_value=private_key),
        patch("weave_backend.audit.emitter.cap_diff_summary", new=AsyncMock(return_value=None)),
        patch(
            "weave_backend.audit.emitter.notify_tenant_admins_of_security_event", new=AsyncMock()
        ) as mock_notify,
    ):
        await HashChainAuditEmitter().emit(conn, _event(event_type="workspace.created"))

    mock_notify.assert_not_awaited()


async def test_emit_survives_notification_dispatch_raising(caplog: Any) -> None:
    """PR #19 review: `dispatch_notification`'s never-raises guarantee only
    covers its Slack retry leg -- its DB awaits (insert_notification, the
    re-entrant `default_audit_emitter.emit`, get_user_prefs) can raise. A
    raise there must not unwind the caller's business transaction; the audit
    entry is the primary record.
    """
    conn = _FakeConnection(existing_seq_row=None)
    private_key = Ed25519PrivateKey.generate()

    with (
        patch("weave_backend.audit.emitter.get_signing_key", return_value=private_key),
        patch("weave_backend.audit.emitter.cap_diff_summary", new=AsyncMock(return_value=None)),
        patch(
            "weave_backend.audit.emitter.notify_tenant_admins_of_security_event",
            new=AsyncMock(side_effect=asyncpg.PostgresError("connection lost")),
        ),
    ):
        event = _event(event_type="security.permission.escalation")
        await HashChainAuditEmitter().emit(conn, event)  # must not raise

    assert len(conn.insert_calls()) == 1
    assert "security notification dispatch failed" in caplog.text

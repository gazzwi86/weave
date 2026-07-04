"""AC-4: `verify_chain`'s Postgres I/O boundary against a stub connection --
the re-computation itself is `chain.verify_entries`, already covered by
`tests/unit/test_audit_chain.py`.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from weave_backend.audit.chain import ZERO_HASH, AuditEntryRecord, PendingEntry, build_entry
from weave_backend.audit.verify import verify_chain

_TENANT = "tenant-abc"


def _rows_for_chain(private_key: Ed25519PrivateKey, count: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    prev_hash = ZERO_HASH
    for i in range(1, count + 1):
        pending = PendingEntry(
            ts=f"2026-07-05T00:00:{i:02d}+00:00",
            tenant_id=_TENANT,
            actor_principal_iri="urn:weave:principal:tenant-abc:human:alice",
            engine="platform",
            event_type="setting.changed",
            target_iri=f"urn:weave:setting:tenant-abc:key-{i}",
            diff_summary=None,
        )
        entry = build_entry(private_key, i, pending, prev_hash)
        prev_hash = entry.hash
        rows.append(_entry_to_row(entry))
    return rows


def _entry_to_row(entry: AuditEntryRecord) -> dict[str, Any]:
    return {
        "seq": entry.seq,
        "ts": entry.ts,
        "tenant_id": entry.tenant_id,
        "actor_principal_iri": entry.actor_principal_iri,
        "engine": entry.engine,
        "event_type": entry.event_type,
        "target_iri": entry.target_iri,
        "diff_summary": None,
        "prev_hash": entry.prev_hash,
        "hash": entry.hash,
        "signature": entry.signature,
    }


class _FakeConnection:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def fetch(self, _query: str, *_args: Any) -> list[dict[str, Any]]:
        return self.rows


async def test_verify_chain_valid_chain_returns_valid_result() -> None:
    private_key = Ed25519PrivateKey.generate()
    conn = _FakeConnection(_rows_for_chain(private_key, 5))

    with patch("weave_backend.audit.verify.get_signing_key", return_value=private_key):
        result = await verify_chain(conn, _TENANT)

    assert result.valid is True
    assert result.entries_checked == 5


async def test_verify_chain_empty_chain_is_valid_with_zero_entries() -> None:
    private_key = Ed25519PrivateKey.generate()
    conn = _FakeConnection([])

    with patch("weave_backend.audit.verify.get_signing_key", return_value=private_key):
        result = await verify_chain(conn, _TENANT)

    assert result.valid is True
    assert result.entries_checked == 0

"""PLAT-AUDIT-1 pure hash-chain logic -- no DB, no AWS. Kept separate from
`emitter.py`/`verify.py` so the chain math itself (canonical serialisation,
hashing, signing, verification) is unit-testable in-memory, matching this
codebase's existing unit/integration split (see `notifications/dispatch.py`
vs. its docker-marked integration tests).
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from hashlib import sha256
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

#: AC-2: the first entry in a tenant's chain has no predecessor.
ZERO_HASH = "0" * 64


@dataclass(frozen=True)
class AuditEntryRecord:
    """The full PLAT-AUDIT-1 persisted shape (contracts.md canonical field
    names) -- distinct from `emitter.AuditEvent`, which is the narrower
    caller-facing shape existing call sites already construct.
    """

    seq: int
    ts: str
    tenant_id: str
    actor_principal_iri: str
    engine: str
    event_type: str
    target_iri: str
    diff_summary: dict[str, Any] | None
    prev_hash: str
    hash: str
    signature: str


@dataclass(frozen=True)
class PendingEntry:
    """The new-entry fields known before `seq`/`prev_hash` are resolved and
    the entry is hashed/signed -- bundled into one object so `build_entry`
    stays within the params-per-function budget (Law E).
    """

    ts: str
    tenant_id: str
    actor_principal_iri: str
    engine: str
    event_type: str
    target_iri: str
    diff_summary: dict[str, Any] | None


@dataclass(frozen=True)
class VerifyResult:
    valid: bool
    entries_checked: int = 0
    first_broken_seq: int | None = None
    error: str | None = None


def _entry_data_without_hash(record: AuditEntryRecord) -> dict[str, Any]:
    data = asdict(record)
    del data["prev_hash"], data["hash"], data["signature"]
    return data


def canonical_json(entry_without_hash: dict[str, Any]) -> str:
    """The one serialisation every hash is computed over. Any variation
    (key order, whitespace) breaks every downstream hash/signature check --
    hence `sort_keys=True` + no separator whitespace, with a regression test
    pinned against a hard-coded expected string.
    """
    return json.dumps(entry_without_hash, sort_keys=True, separators=(",", ":"))


def compute_hash(entry_without_hash: dict[str, Any]) -> str:
    return sha256(canonical_json(entry_without_hash).encode()).hexdigest()


def sign_entry(private_key: Ed25519PrivateKey, hash_val: str, prev_hash: str) -> str:
    return private_key.sign(f"{hash_val}{prev_hash}".encode()).hex()


def verify_entry_signature(
    public_key: Ed25519PublicKey, hash_val: str, prev_hash: str, signature_hex: str
) -> bool:
    try:
        public_key.verify(bytes.fromhex(signature_hex), f"{hash_val}{prev_hash}".encode())
    except InvalidSignature:
        return False
    return True


def build_entry(
    private_key: Ed25519PrivateKey, seq: int, pending: PendingEntry, prev_hash: str
) -> AuditEntryRecord:
    """AC-1/AC-2: computes `hash` over the canonical entry (everything but
    `prev_hash`/`hash`/`signature`) and signs `hash || prev_hash`.
    """
    entry_data = {"seq": seq, **asdict(pending)}
    hash_val = compute_hash(entry_data)
    signature = sign_entry(private_key, hash_val, prev_hash)
    return AuditEntryRecord(
        seq=seq,
        ts=pending.ts,
        tenant_id=pending.tenant_id,
        actor_principal_iri=pending.actor_principal_iri,
        engine=pending.engine,
        event_type=pending.event_type,
        target_iri=pending.target_iri,
        diff_summary=pending.diff_summary,
        prev_hash=prev_hash,
        hash=hash_val,
        signature=signature,
    )


def verify_entries(
    entries: Sequence[AuditEntryRecord], public_key: Ed25519PublicKey
) -> VerifyResult:
    """AC-4's re-computation, over an already-fetched (or in-memory-built)
    ordered sequence -- `verify.verify_chain` is the thin async wrapper that
    fetches rows from Postgres and delegates here.
    """
    prev_hash = ZERO_HASH
    checked = 0
    for entry in entries:
        expected_hash = compute_hash(_entry_data_without_hash(entry))
        if entry.hash != expected_hash:
            return VerifyResult(
                valid=False,
                entries_checked=checked,
                first_broken_seq=entry.seq,
                error="hash_mismatch",
            )
        if entry.prev_hash != prev_hash:
            return VerifyResult(
                valid=False,
                entries_checked=checked,
                first_broken_seq=entry.seq,
                error="chain_broken",
            )
        if not verify_entry_signature(public_key, entry.hash, entry.prev_hash, entry.signature):
            return VerifyResult(
                valid=False,
                entries_checked=checked,
                first_broken_seq=entry.seq,
                error="signature_invalid",
            )
        prev_hash = entry.hash
        checked += 1
    return VerifyResult(valid=True, entries_checked=checked)

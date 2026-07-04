"""AC-1/AC-2/AC-4 pure hash-chain unit tests -- no DB, no AWS."""

from __future__ import annotations

from dataclasses import replace

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from weave_backend.audit.chain import (
    ZERO_HASH,
    AuditEntryRecord,
    PendingEntry,
    build_entry,
    canonical_json,
    compute_hash,
    verify_entries,
    verify_entry_signature,
)

_TENANT = "tenant-abc"
_ACTOR = "urn:weave:principal:tenant-abc:human:alice"


def _key() -> Ed25519PrivateKey:
    return Ed25519PrivateKey.generate()


def _pending(event_type: str, target_iri: str, ts: str) -> PendingEntry:
    return PendingEntry(
        ts=ts,
        tenant_id=_TENANT,
        actor_principal_iri=_ACTOR,
        engine="platform",
        event_type=event_type,
        target_iri=target_iri,
        diff_summary=None,
    )


def test_canonical_json_matches_hard_coded_expected_string() -> None:
    """Brief's explicit requirement: pin the canonical serialisation against
    a hard-coded string so any future change to key order/whitespace fails
    loudly here instead of silently breaking every downstream hash.
    """
    entry_data = {
        "seq": 1,
        "ts": "2026-07-05T00:00:00+00:00",
        "tenant_id": "tenant-abc",
        "actor_principal_iri": "urn:weave:principal:tenant-abc:human:alice",
        "engine": "platform",
        "event_type": "workspace.created",
        "target_iri": "urn:weave:workspace:tenant-abc:ws-1",
        "diff_summary": {"name": "Ops"},
    }
    expected = (
        '{"actor_principal_iri":"urn:weave:principal:tenant-abc:human:alice",'
        '"diff_summary":{"name":"Ops"},"engine":"platform",'
        '"event_type":"workspace.created","seq":1,"target_iri":'
        '"urn:weave:workspace:tenant-abc:ws-1","tenant_id":"tenant-abc",'
        '"ts":"2026-07-05T00:00:00+00:00"}'
    )
    assert canonical_json(entry_data) == expected


def test_audit_entry_hash_and_signature() -> None:
    """AC-1: hash = SHA-256(canonical_json(entry_without_hash)); signature
    verifies over hash || prev_hash with the matching public key.
    """
    private_key = _key()
    pending = _pending(
        "workspace.created", "urn:weave:workspace:tenant-abc:ws-1", "2026-07-05T00:00:00+00:00"
    )
    entry = build_entry(private_key, 1, pending, ZERO_HASH)
    entry_data = {
        "seq": entry.seq,
        "ts": entry.ts,
        "tenant_id": entry.tenant_id,
        "actor_principal_iri": entry.actor_principal_iri,
        "engine": entry.engine,
        "event_type": entry.event_type,
        "target_iri": entry.target_iri,
        "diff_summary": entry.diff_summary,
    }
    assert entry.hash == compute_hash(entry_data)
    assert verify_entry_signature(
        private_key.public_key(), entry.hash, entry.prev_hash, entry.signature
    )


def test_audit_chain_prev_hash_links_and_genesis_is_zero_hash() -> None:
    """AC-2: first entry's prev_hash is the zero-hash genesis; second
    entry's prev_hash equals the first entry's hash.
    """
    private_key = _key()
    first_pending = _pending(
        "workspace.created", "urn:weave:workspace:tenant-abc:ws-1", "2026-07-05T00:00:00+00:00"
    )
    first = build_entry(private_key, 1, first_pending, ZERO_HASH)
    second_pending = _pending(
        "member.invited", "urn:weave:workspace:tenant-abc:ws-1", "2026-07-05T00:00:01+00:00"
    )
    second = build_entry(private_key, 2, second_pending, first.hash)
    assert first.prev_hash == ZERO_HASH
    assert second.prev_hash == first.hash


def _build_chain(private_key: Ed25519PrivateKey, count: int) -> list[AuditEntryRecord]:
    entries: list[AuditEntryRecord] = []
    prev_hash = ZERO_HASH
    for i in range(1, count + 1):
        pending = _pending(
            "setting.changed",
            f"urn:weave:setting:tenant-abc:key-{i}",
            f"2026-07-05T00:00:{i:02d}+00:00",
        )
        entry = build_entry(private_key, i, pending, prev_hash)
        entries.append(entry)
        prev_hash = entry.hash
    return entries


def test_audit_chain_verification_valid() -> None:
    """AC-4: an untampered chain verifies as fully valid."""
    private_key = _key()
    entries = _build_chain(private_key, 10)
    result = verify_entries(entries, private_key.public_key())
    assert result.valid is True
    assert result.entries_checked == 10
    assert result.first_broken_seq is None


def test_audit_chain_verification_broken() -> None:
    """Brief's literal scenario: emit 5 entries, tamper one, assert
    `{"valid": false, "first_broken_seq": N}`.
    """
    private_key = _key()
    entries = _build_chain(private_key, 5)
    entries[2] = replace(entries[2], target_iri=entries[2].target_iri + "-tampered")

    result = verify_entries(entries, private_key.public_key())
    assert result.valid is False
    assert result.first_broken_seq == 3


def test_audit_chain_verification_detects_single_entry_tampering_mid_chain() -> None:
    """AC-4: tampering with one entry (seq 50 of 100) is detected at that
    exact seq, not merely "somewhere" -- required by the task brief's DoD.
    """
    private_key = _key()
    entries = _build_chain(private_key, 100)
    tampered = entries[49]
    entries[49] = replace(tampered, target_iri=tampered.target_iri + "-tampered")

    result = verify_entries(entries, private_key.public_key())
    assert result.valid is False
    assert result.first_broken_seq == 50
    assert result.error == "hash_mismatch"


def test_audit_chain_verification_detects_broken_prev_hash_link() -> None:
    """AC-4: a hash that individually re-computes correctly but no longer
    matches its predecessor's hash is still detected as chain_broken.
    """
    private_key = _key()
    entries = _build_chain(private_key, 5)

    # Rebuild entry 3 with a wrong prev_hash but a self-consistent hash/sig,
    # so only the inter-entry link is broken, not the entry's own hash.
    bad_pending = _pending(entries[2].event_type, entries[2].target_iri, entries[2].ts)
    entries[2] = build_entry(private_key, entries[2].seq, bad_pending, "f" * 64)

    result = verify_entries(entries, private_key.public_key())
    assert result.valid is False
    assert result.first_broken_seq == 3
    assert result.error == "chain_broken"


def test_audit_chain_verification_detects_reordered_entries() -> None:
    """QA edge case (AC-4): each individual entry is untampered and
    internally self-consistent (its own hash/signature still verify), but
    the sequence handed to `verify_entries` is reordered (positions 2 and 3
    swapped). This must be caught as `chain_broken`, not pass silently just
    because no single entry's hash/signature was touched -- reordering
    attacks tampering with sequence, not content.
    """
    private_key = _key()
    entries = _build_chain(private_key, 5)
    reordered = list(entries)
    reordered[1], reordered[2] = reordered[2], reordered[1]

    result = verify_entries(reordered, private_key.public_key())
    assert result.valid is False
    assert result.error == "chain_broken"
    # The swapped-in entry (seq=3) is checked at list position 2 (0-indexed),
    # where entry seq=2's prev_hash was expected -- it fails there first.
    assert result.first_broken_seq == 3


def test_audit_chain_verification_detects_invalid_signature() -> None:
    """AC-4: a hash/prev_hash that are internally consistent but signed with
    the wrong key is detected as signature_invalid."""
    private_key = _key()
    wrong_key = _key()
    pending = _pending(
        "workspace.created", "urn:weave:workspace:tenant-abc:ws-1", "2026-07-05T00:00:00+00:00"
    )
    entry = build_entry(wrong_key, 1, pending, ZERO_HASH)
    result = verify_entries([entry], private_key.public_key())
    assert result.valid is False
    assert result.first_broken_seq == 1
    assert result.error == "signature_invalid"

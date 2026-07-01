---
type: Coding Standard
title: Audit & Immutability — Coding Standard
description: "The single platform audit/provenance service PLAT-AUDIT-1: append-only DB constraints, hash-chain + ed25519 signing, typed event shape, export verification, and engine log views."
tags: [standards, audit, provenance, immutability, security, compliance]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/audit-immutability.md
---

# Audit & Immutability Standards

Weave has **one** immutable audit/provenance service: `PLAT-AUDIT-1` (platform PRD
Epic 9, FR-036–FR-038). Engines **emit** typed events; they do not run their own audit
stores. Build's decision-log and Events' run-log are **views** over `PLAT-AUDIT-1`. The
Constitution Engine keeps PROV-O as semantic provenance **and** writes a corresponding
`PLAT-AUDIT-1` entry for every consequential write.

These rules gate generated code: any engine that records its own parallel,
mutable audit store, or that lets an audit row be updated or deleted, is a defect.

## Single service, engines emit

- There is exactly one audit service. Do not create a per-engine audit table.
- Engines call the `PLAT-AUDIT-1` emit API for every **consequential event**: data
  writes, version publishes, RBAC denials (HTTP 403), connector failures, budget
  rejections, settings changes, self-improvement state transitions.
- Build's decision-log and Events' run-log render **as views** querying `PLAT-AUDIT-1`
  — they do not persist their own copy (PRD Epic 9 A2).
- CE writes both PROV-O (semantic provenance in `weave:graph/prov`, see
  `semantic-web.md`) **and** a `PLAT-AUDIT-1` entry; the canonical principal IRI
  (`PLAT-IDENTITY-1`) is shared by both.

## Typed audit event shape

Every entry has this exact shape (FR-036, E9-S1). Generated emit calls must populate
all fields; the chain fields are set by the service, not the caller.

```python
class AuditEntry(BaseModel):
    seq: int                    # monotonic sequence, service-assigned
    ts: datetime                # UTC, service-assigned at append
    actor_principal_iri: str    # canonical principal IRI (PLAT-IDENTITY-1)
    engine: str                 # "platform" | "constitution" | "build" | "events" | "explorer"
    event_type: str             # open taxonomy, e.g. "rbac.denied", "version.published"
    target_iri: str             # the resource the event is about
    diff_summary: str           # human-readable summary of the change
    prev_hash: str              # hash of the previous entry (service-set)
    hash: str                   # hash over canonicalised entry + prev_hash (service-set)
    signature: str              # ed25519 over the canonicalised entry + prev_hash
```

**Rules:**

- `event_type` is an **open, registerable taxonomy** — not a fixed enum (consistent
  with the notification taxonomy). Use dotted lower-case names.
- `actor_principal_iri` is mandatory and is the canonical principal IRI for both human
  and agent actors. Never write a bare username or `"user"` string in the product (the
  prototype's `agent="user"` literal in
  `prototypes/weave-prototype/backend/app/api/routes.py:478` is a prototype shortcut;
  production uses the principal IRI).
- Never log PII into `diff_summary`. PII feeding the downstream sentiment NLP job is
  scrubbed before the model (PRD §6).

## Append-only DB-constraint mechanism

Immutability is enforced at the **database-constraint level**, not by application
convention (FR-036, E9-S1).

- The audit table grants `INSERT` only. `UPDATE` and `DELETE` are revoked from the
  application role; attempts are **rejected at the DB-constraint level** and the
  attempt **itself is logged** (E9-S1).
- Enforce with both: revoke `UPDATE`/`DELETE` privileges from the app role, **and** add
  a row-level rule/trigger that raises on `UPDATE`/`DELETE` so the constraint holds even
  for a mis-scoped grant.
- `seq` is monotonic and gap-free per partition; `prev_hash` of entry *n* equals `hash`
  of entry *n-1*.
- Self-improvement records are **retained, never deleted**, including rejected proposals
  (FR-044).

```sql
-- Application role can append only.
REVOKE UPDATE, DELETE ON audit_log FROM weave_app;
GRANT INSERT, SELECT ON audit_log TO weave_app;

-- Defence in depth: reject mutation even if a grant is mis-scoped.
CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

## Signature / hash-chain scheme

Tamper-evidence requires a **chain**, not merely a per-entry signature (PRD §7
decision; E9-S1 resolving Finding 5). The prototype already records a hash-chained,
PROV-stamped history (`prototypes/weave-prototype/backend/app/ontology/store.py`
`record_history_event` / `stamp_activity`); the product hardens this with ed25519.

For each new entry:

1. Build the **canonical form** of the entry (deterministic field order, UTF-8, no
   insignificant whitespace) over the typed fields **excluding** `hash` and `signature`.
2. `hash = SHA-256(canonical_entry || prev_hash)`.
3. `signature = ed25519_sign(signing_key, canonical_entry || prev_hash)`.
4. Append with `prev_hash` = the prior entry's `hash`.

```python
def seal(entry: AuditEntry, prev_hash: str, signing_key: SigningKey) -> AuditEntry:
    canonical = canonicalise(entry)              # deterministic, excludes hash/signature
    payload = canonical + prev_hash.encode()
    entry.prev_hash = prev_hash
    entry.hash = hashlib.sha256(payload).hexdigest()
    entry.signature = signing_key.sign(payload).signature.hex()
    return entry
```

- The signing key lives in **AWS Secrets Manager only** — never in source, env files,
  or logs (PRD §6; `rules/security.md`).
- The genesis entry uses a fixed, documented `prev_hash` sentinel (e.g. 64 zeros).

## Query and export-verification format

- Audit is **queryable** by date / actor / event-type / resource / engine, **paginated**
  (default ≤ 500 rows/page, tunable — FR-037).
- **Export** is **JSON or NDJSON**, each line one full entry including `prev_hash`,
  `hash`, and `signature`.
- The export ships with a **chain-verification procedure** that a third party can run:

  1. For each entry, recompute `hash` over the canonicalised entry + `prev_hash`;
     assert it equals the stored `hash`.
  2. Verify the ed25519 `signature` over the same payload with the published public key.
  3. Assert each entry's `prev_hash` equals the previous entry's `hash` and `seq` is
     contiguous.

- **Tamper test (mandatory release gate):** alter or delete any historical entry, then
  run verification — it **must fail at the named row** (E9-S1 tamper AC; PRD §9).

```python
def verify_chain(entries: list[AuditEntry], public_key: VerifyKey) -> None:
    prev = GENESIS_PREV_HASH
    for e in entries:
        payload = canonicalise(e) + prev.encode()
        assert e.hash == hashlib.sha256(payload).hexdigest(), f"hash mismatch at seq {e.seq}"
        public_key.verify(payload, bytes.fromhex(e.signature))  # raises on tamper
        assert e.prev_hash == prev, f"chain break at seq {e.seq}"
        prev = e.hash
```

## Engine logs are views

- Build decision-log and Events run-log query `PLAT-AUDIT-1` filtered by `engine` and
  `event_type`; they are **read-only projections**.
- Audit is surfaced in the UI as a **sub-view under the Compliance area**, not a
  separate top-level area, readable by the Compliance role (FR-038, E5-S1).
- Every audit write emits an OpenTelemetry span correlating `seq`,
  `actor_principal_iri`, and `engine` (PRD §6 Observability).

## Checklist (generated code must satisfy)

- [ ] No engine has its own mutable audit store; all emit to `PLAT-AUDIT-1`.
- [ ] Every consequential event (writes, 403s, publishes, connector/budget failures,
      settings changes) emits a typed entry.
- [ ] `actor_principal_iri` is a canonical principal IRI, never a bare username.
- [ ] Audit table is append-only at the DB-constraint level (revoke + rule/trigger);
      UPDATE/DELETE attempts are logged.
- [ ] Each entry hash-chains to the previous and carries an ed25519 signature over the
      canonicalised entry + prev_hash; signing key in Secrets Manager.
- [ ] Export is JSON/NDJSON with a runnable chain-verification procedure.
- [ ] A tamper test fails verification at the altered row.
- [ ] Build/Events logs are read-only views over `PLAT-AUDIT-1`.

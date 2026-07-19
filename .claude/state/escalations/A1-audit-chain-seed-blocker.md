# A1 escalation: brief's root-cause hypothesis refuted by live data

**Task:** A1 (docs/design/remediation-2-api-gaps.md) — demo-workspace audit chain shows
"Chain broken at entry 2 · 0 entries checked" on the Compliance page.

**Brief's hypothesis (prime suspect):** `clock_timestamp()`/`ORDER BY` tie-break bug class
(known precedent: migrations 0065, 0083 — `DEFAULT now()` freezes per-transaction, ties on
`created_at`, nondeterministic `ORDER BY` tie-break). Preferred fix: order chain verification
by monotonic seq/PK, new Alembic migration.

## Why this hypothesis does not hold here

1. `packages/backend/migrations/0005_audit_chain.sql` — `audit_entries.ts` is `TEXT NOT NULL`,
   **app-assigned** (`datetime.now(UTC).isoformat()` in `emitter.py`), never a DB `now()`
   default. No clock-tie surface exists.
2. `packages/backend/src/weave_backend/audit/verify.py::_fetch_ordered_entries` already does
   `ORDER BY seq ASC` — not by timestamp. `seq` is monotonic, assigned under
   `pg_advisory_xact_lock(hashtext(tenant_id))` in `emitter.py`, one persisted value per row
   (no ties possible).
3. Direct read of the live "weave" primary demo DB (`acme-corp` tenant, 12 real
   `audit_entries` rows, read-only query, no mutation) recomputing hash/prev_hash/signature
   per entry independently (bypassing "stop at first failure"):

   ```
   seq=1  hash_ok=True prev_ok=True sig_ok=True
   seq=2  hash_ok=True prev_ok=True sig_ok=False
   seq=3  hash_ok=True prev_ok=True sig_ok=False
   seq=4  hash_ok=True prev_ok=True sig_ok=False
   seq=5  hash_ok=True prev_ok=True sig_ok=False
   seq=6  hash_ok=True prev_ok=True sig_ok=False
   seq=7  hash_ok=True prev_ok=True sig_ok=False
   seq=8  hash_ok=True prev_ok=True sig_ok=False
   seq=9  hash_ok=True prev_ok=True sig_ok=False
   seq=10 hash_ok=True prev_ok=True sig_ok=True
   seq=11 hash_ok=True prev_ok=True sig_ok=True
   seq=12 hash_ok=True prev_ok=True sig_ok=True
   ```

   `hash_ok`/`prev_ok` are **100% correct across all 12 entries** — chain linkage and
   ordering have no bug. The only failure is `sig_ok=False`, confined to a contiguous
   ~230ms burst of entries (seq 2-9, all 19:09:14 on 2026-07-16), sandwiched between good
   entries before (seq 1, 19:09:01) and after (seq 10-12, spanning 2026-07-17 to
   2026-07-19). This "good-bad-good" sandwich is inconsistent with a permanent key
   rotation or key loss on restart (which would orphan everything after some point, not a
   bounded middle burst) — it looks like a one-time signing-key divergence between two
   processes during that specific dev session (the shared "weave" primary stack has had
   several engineer worktrees pointed at it), not a reproducible code defect.

4. Controlled reproduction attempts against a fresh isolated stack (both "N emits within
   one transaction" and "N concurrent processes racing the key-bootstrap" patterns) pass
   cleanly on current code — the ordering/emit/verify path and the key-bootstrap race
   guard in `signing_key.py` both work correctly under direct test.

## What I am doing instead

- **Not** writing the ordering-migration the brief specified — there is no ordering bug to
  fix, and a schema change for a non-bug would be a false diff against its own commit
  message.
- **Fixing** a real, separate, confirmed bug found during this investigation: `chain.py`'s
  `verify_entries` always reports `entries_checked=0` on any failure path (the dataclass
  default is never overridden before the early `return`), which is the second half of the
  reported symptom ("0 entries checked" next to "broken at entry 2").
- **Adding** the demo-seed → verify regression test the brief asked for (closes the gap
  that `test_seed_demo.py` never calls verify) — it passes against current code, which is
  itself the useful result: the seed path does not corrupt the chain.
- **Not** attempting to un-break the specific stale seq 2-9 signatures on the shared
  primary demo DB — a hash-chain signature over a lost/foreign key is cryptographically
  unrecoverable by design; the only fix is operational (reseed that tenant's audit
  history), not code.

## Open questions for the coordinator

1. **Demo reset**: who/how resets the `acme-corp` tenant's `audit_entries` on the shared
   primary stack so the Compliance page banner clears? (Explicitly NOT done by me — other
   worktrees/agents are live against that same stack; a `docker compose down -v` there
   would affect them.)
2. **Signing-key durability**: is it worth hardening `signing_key.py` against
   multi-process/multi-worktree key divergence (e.g. failing loudly instead of silently
   caching a key that turns out to differ from what's persisted), or is this accepted as
   an inherent property of local dev with multiple worktrees sharing one LocalStack
   instance? Flagging only — not building on a hunch.

Recommendation: accept the `entries_checked` fix + new regression test as the code-level
resolution of A1, treat the specific stale demo entries as a data-remediation item for the
coordinator to schedule separately.

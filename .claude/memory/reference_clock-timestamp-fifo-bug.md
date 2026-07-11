---
name: reference_clock-timestamp-fifo-bug
description: Recurring bug class — Postgres DEFAULT now() freezes per-transaction, breaking FIFO ORDER BY created_at; fix is clock_timestamp()
metadata:
  type: reference
---

Recurring, non-obvious bug class hit twice in the M2/V1 build (migrations 0065 and 0083):

**Symptom:** an integration test that passes in isolation flakes only inside the full CI suite —
FIFO delivery/order assertions ("2nd enqueued row is delivered 2nd") fail nondeterministically.

**Root cause:** a table whose rows are ordered by `created_at` (via `ORDER BY created_at` in the
reader) uses `created_at TIMESTAMPTZ DEFAULT now()`. Postgres `now()` / `transaction_timestamp()`
is frozen at **transaction start** — every row inserted inside one transaction gets the IDENTICAL
timestamp. The common trigger: a mutation enqueues several outbox/log rows in the same transaction
as the write, or a batch path inserts several rows back-to-back. With tied timestamps, Postgres's
tie-break among equal sort keys is UNDEFINED, so insertion order is not preserved and the reader
re-selects the wrong "next" row depending on run context (heap layout, load) — hence isolation-pass
/ full-suite-flake.

**Fix:** `ALTER TABLE <t> ALTER COLUMN created_at SET DEFAULT clock_timestamp();` — `clock_timestamp()`
is per-STATEMENT wall time, so each insert gets a distinct, monotonic timestamp and insertion order
is always preserved. Migrations 0065 (`generation_runs`) and 0083 (`audit_outbox`) are the two
instances.

**Pre-empt:** any NEW table with `created_at` that a reader sorts FIFO, AND where multiple rows can
be inserted in one transaction/batch, must default to `clock_timestamp()`, not `now()`. Grep new
migrations for `DEFAULT now()` on a `created_at` that any `ORDER BY created_at` consumes. Sibling
landmines in [[reference_epic-close-ci-discipline]] (poison-endpoint hermeticity, mutmut double-run).

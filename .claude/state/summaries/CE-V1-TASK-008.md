# Progress: CE-V1-TASK-008 — CE-EVENT-1 Change-Feed (Beta Transport) (EPIC-009 root)

`constitution-engine` EPIC-009. LANE F worktree `../weave-CE-V1-EPIC-009`, branch `feature/CE-V1-EPIC-009` (off ba818b9 →
restack onto green main at epic-close). Backend. Built across passes (all committed, tree clean). Coordinator-authored from
commit log. HEAD `0811c5b`, not pushed.

## What shipped (6 commits)
- `b93dc89` migration `graph_change_events` table + event-shape helpers. `239906f` emit change events from the SHARED
  CE-WRITE-1 pipeline (`operations/pipeline.py`). `e3f7f40` CE-EVENT-1 change-feed READ route (`routers/events.py`).
- `84aef24` integration tests. `8e74112` fix: grant weave_app USAGE on the graph_change_events SEQUENCE (real RLS/grant bug
  found+fixed). `0811c5b` test: change-feed actor = the authenticated principal (PROV/attribution).

## QA MUST VERIFY (no engineer final report — validate from scratch)
1. **Pipeline event-emission regression** (`239906f` = SHARED pipeline.py) — full backend unit suite green; a ROLLED-BACK
   write does NOT emit a committed change-event; no double-emit; other writes unaffected.
2. **Integration ran WITH the marker** (PROJ-003): `test_events_change_feed.py -m "integration and docker and not stack"` —
   confirm RUNS (count, not deselected). Actor = authenticated principal.
3. Migration **0062** `graph_change_events` — tenant-scoped + RLS + the sequence USAGE grant (8e74112).
4. CE-EVENT-1 contract fidelity vs contracts.md. Every AC has a test (count exactly).
5. **XT-WRITEPATH-2:** pipeline.py change shares the file with CE-005 (tenant-SHACL, EPIC-005) + CE-009 (immutability,
   EPIC-010 merging now) — reconcile at merge (union). CE-009's immutability landed via EPIC-010 restack; CE-008 restacks after.

## Commits (feature/CE-V1-EPIC-009, not pushed): b93dc89 · 239906f · e3f7f40 · 84aef24 · 8e74112 · 0811c5b (HEAD).

## Epic status: EPIC-009 root. Check epic-check for more tasks. Restack onto green main at close (pipeline.py union w/ EPIC-005/010).

## QA PASS (2026-07-11, a385850, retry 0) — CE-V1-TASK-008 CLOSES → EPIC-009 COMPLETE
Adversarial QA, all 7 ACs (AC-008-01..07) PASS, validated from scratch (no engineer report). **Top risk — rollback→no
phantom event: PASS** — traced the transaction boundary: `apply_operations_route` wraps the WHOLE pipeline in one
`tenant_connection` (real `conn.transaction()`); `record_commit_event` inserts on `ctx.conn` BEFORE outer commit; any failure
(incl. the deliberately-last `load_graph` promotion) rolls back the event row too. Engineer's `test_forced_commit_failure_
rolls_back_leaving_no_orphan_event` (patches write_activity to raise mid-commit → asserts graph untouched AND events empty)
ran green. Constraint-violated path (AC-008-02) correctly writes on a SEPARATE tenant_connection (no committed data to ride).
**Migration 0062 PASS:** ENABLE+FORCE RLS + tenant_isolation policy + `GRANT SELECT,INSERT ... TO weave_app` + BIGSERIAL
sequence USAGE grant (8e74112); append-only enforced TWICE (no UPDATE/DELETE grant + BEFORE UPDATE/DELETE trigger RAISE —
fires even for superuser). Proven empirically (all integration writes go through weave_app role; a missing grant would 500
every test). **Actor = JWT principal_iri** (never client body's `actor`); `0811c5b` fixed a test that asserted the spoofable
value. Cross-tenant feed isolation test (A can't see B's rows) green. **No double-emit** — `record_commit_event` has exactly
2 call sites (pipeline success + violation branch), grep-confirmed; pipeline.py imported only by routers/operations.py so
brand/glossary/ingest can't trigger it. Gates: ruff 0, mypy 0/469, full unit suite green, 6/6 integration (5 engineer + 1
QA-added). QA added `test_get_events_returns_410_when_cursor_predates_retention_window` (real PUT /api/settings retention=0 →
410 not silent-empty; commit `147be3e`). retry=0.

**2 WARN (non-blocking):**
- **Perf**: QA flagged no locust harness for GET /api/events p95≤200ms (m2-delta §9). NOTE: this is the PROJ-002 systemic
  issue — M2 perf DoD is met via ADR-004 in-process benchmark, NOT locust. CE-008 (unlike CE-007) has NO benchmark → logged
  as **XT-CE008-PERF** (add a benchmark before phase gate; endpoint is an indexed cursor SELECT, met-by-inference interim).
- **AC-008-03 publish-path scope gap**: `POST /api/ontology/versions/{iri}/publish` never calls record_commit_event — only
  the CE-WRITE-1 draft path emits. QA judged DELIVERED-for-scope because the Scope section, m2-delta §10 diagram (no publish
  arrow), and §11 invariant all agree — but the brief's AC-008-03 TABLE text is broader (spec self-contradiction). → morning
  HITL: is publish-side emission in scope (new task) or is the brief AC table wrong (fix brief)? Logged **XT-CE008-AC03**.

## EPIC-009 CLOSE → HELD (migration 0062 = schema, per auto-merge policy)
CE-008 is EPIC-009's sole task → epic COMPLETE. Restack onto green main (union pipeline.py — CE-009's immutability gate
already merged via EPIC-010; CE-005's tenant-SHACL still on its own branch). Open PR, get green + review-clean, then HOLD for
human merge (migration/schema tier). Surfaced in overnight-queue HELD PRs.

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

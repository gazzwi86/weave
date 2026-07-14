# CE-V1-TASK-019 — partial-slice deferral ledger (Option A, coordinator-approved 2026-07-14)

EPIC-012 stays **open**. This is not an epic close. Every AC below that is not fully delivered is
listed with the exact missing prerequisite and the task that must land first.

| AC | What it asks | Delivered today | Deferred part | Missing prerequisite | Unblocked by |
|---|---|---|---|---|---|
| AC-008-01 | Upload w/ file-type routing, optional context step, job list w/ live status + summaries | Yes — upload, context step (skippable), client-tracked job list, live status poll | — | — | — |
| AC-008-02 | Proposal review: op-list card, mapping row, merge side-by-side, flagged distinct | Op-list card renderer only (reused from TASK-013's `IngestProposalCard`); flagged-not-preselected | Mapping-row renderer (structured import) and merge side-by-side renderer | `IngestProposal` schema has no `kind`/mapping/merge discriminator; no data shape to render | TASK-015 (structured import) for mapping row; TASK-018 (SKOS reconciliation) for merge view |
| AC-008-03 | Lighthouse perf ≥90, a11y ≥95, best-practices ≥90, JS ≤200KB, full keyboard nav | Delivered for the page as built (document-only import surface) | Re-audit needed once mapping/merge views land (added JS weight, more interactive surface) | N/A yet — page doesn't have those views | Re-run when TASK-015/018 UI lands |
| AC-008-04 | Epic E2E: doc upload leg AND BPMN import leg AND NL citation leg | Doc-upload leg only, as a Playwright browser E2E (`tests/e2e/ce-import.spec.ts`): real login/session/proxy routes, ingest network mocked for determinism (mirrors the already-reviewed `ce-ingest.spec.ts` convention) — upload → proposal review → accept one/reject one → 422-inline-violation case | BPMN-fixture leg; NL-citation leg as a *browser* E2E; real (non-mocked) backend-state assertion via Playwright | BPMN: no extractor exists. NL-citation-as-E2E: the query page UI doesn't render `QueryResponse.citations` at all yet — asserting it in a browser E2E would need UI work nobody asked for. Real-backend Playwright assertion: needs a dedicated fixture-backend E2E lane (separate webServer/port wired to `WEAVE_MODEL_PROVIDER=fixture`) — infra decision, not built this pass to stay bounded. Real backend-state proof for accept/reject today comes from the already-merged Python `test_ingest_pipeline.py` (docker-integration, exercises real CE-WRITE-1 commit). | BPMN: TASK-015. NL-citation UI: whichever task owns query-page citation rendering. Real-backend E2E lane: follow-up infra task (the `FixtureProvider` added this pass, `packages/backend/src/weave_backend/ai/providers.py`, is ready for it) |
| AC-008-05 | CI structural asserts: `no-second-mutation-path-ingest`, `corpus-read-side-only`, `no-DSN-in-RML-config`, `settings-not-literals` — made permanent | `no-second-mutation-path-ingest` (already existed as a unit test, `tests/unit/test_ingest_no_second_mutation_path.py` — now referenced from CI-permanent tier) and `corpus-read-side-only` (`tests/unit/test_ingest_corpus.py`'s read-side assertion, same treatment) | `no-DSN-in-RML-config` skipped — its subject (the RML mapping config file) does not exist; `settings-not-literals` scoped to ingest surface only for what's built | R2RML/RML mapping layer | TASK-017 |
| AC-008-06 | Merge v1-delta §9 invariants into `tech-spec/invariants.md`, verify-by selectors intact | Not done this pass — invariants.md merge is epic-close paperwork; doing it now would over-claim coverage for stories 015-018 that don't exist | Whole AC | All of TASK-015/016/017/018 | Do at real epic close |
| AC-008-07 | Ingest perf p95 checks (v1-delta §2) | Not added this pass (ce-perf budget wiring is its own gate-touching change, out of scope for the honest-slice deliverable; existing ingest endpoints already have no p95 regression from this UI-only change since no new backend code was added on the request path) | Whole AC | ce-perf harness wiring decision (separate from this UI task) | Follow-up task, not blocked on 015-018 |

## What this means concretely for the codebase

- `/import` page ships today: upload, optional context, job list (client-tracked — no new
  "list all jobs" backend endpoint was added; see ADR note below), single-card proposal review,
  accept/reject, inline 422 violations.
- The `ProposalReview` renderer is intentionally a **single** renderer (op-list card) — no
  `kind`-based switch was added, because there is nothing to switch on yet. When TASK-015/018
  land and `IngestProposal` gains a discriminator, add the switch then (do not build it speculatively
  now — YAGNI).
- Epic status: **EPIC-012 remains open.** Do not update its epic-level "closed"/"done" marker
  anywhere (roadmap, kanban, progress.json) from this task.

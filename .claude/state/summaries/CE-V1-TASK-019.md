# CE-V1-TASK-019 — Import & Ingest Page (Option A partial slice)

QA: PASS. EPIC-012 stays **open** — this is a partial-slice delivery, not epic close.

## Why partial

Task brief depends on TASK-013..018. Only TASK-013/014 exist in code; TASK-015 (BPMN/ArchiMate
import), TASK-016 (image-to-data), TASK-017 (R2RML/RML structured import), TASK-018 (SKOS merge
reconciliation) have no task briefs, no code. Escalated
(`.claude/state/escalations/CE-V1-TASK-019-blocker.md`), coordinator approved Option A: ship the
honest document-import subset now, track every deferral explicitly, leave the epic open.

## What shipped

- `/ce/import` page: file upload, optional context step (source_system/owner/date_of_truth/
  sensitivity/context — matches backend's real `CONTEXT_FIELDS` whitelist), client-tracked job
  list (no server "list all jobs" endpoint exists, so job IDs are tracked in frontend state and
  each polled via the existing per-job endpoint), one-at-a-time proposal review/accept/reject
  reusing TASK-013's `IngestProposalCard` (no new renderer — nothing to switch on yet, YAGNI).
- `FixtureProvider` (`packages/backend/src/weave_backend/ai/providers.py`, opt-in via
  `WEAVE_MODEL_PROVIDER=fixture`) — deterministic canned-response AI provider for Law F E2E
  determinism. Built and tested; not yet wired into a live-backend Playwright lane (see deferred).
- 2 Playwright E2E specs (`tests/e2e/ce-import.spec.ts`): upload → review → accept one/reject one →
  job summary; and 422 SHACL-violation inline rendering. Ingest network mocked, mirroring the
  already-reviewed `ce-ingest.spec.ts` convention (live LLM calls are slow/nondeterministic).
- CI structural asserts (AC-008-05): `no-second-mutation-path-ingest` and `corpus-read-side-only`
  already run permanently (pre-existing unit tests, collected by default CI). `no-DSN-in-RML-config`
  explicitly `pytest.mark.skip`'d with a `ponytail:` comment — no RML config file exists yet to
  scan, never faked green.

## Delivered vs deferred (full detail in the ledger)

Full table: `.claude/state/escalations/CE-V1-TASK-019-partial.md`.

| AC | Delivered | Deferred | Unblocked by |
|---|---|---|---|
| AC-008-01 | Upload, context step, job list, live poll | — | — |
| AC-008-02 | Op-list card only | Mapping-row, merge side-by-side | TASK-015, TASK-018 |
| AC-008-03 | Lighthouse pass for doc-only surface | Re-audit after mapping/merge UI lands | TASK-015/018 |
| AC-008-04 | Doc-upload leg E2E (mocked network) | BPMN leg, NL-citation-as-E2E, real-backend Playwright assertion | TASK-015; query-page citation UI owner; follow-up infra task |
| AC-008-05 | 2/3 structural asserts permanent | `no-DSN-in-RML-config` skipped | TASK-017 |
| AC-008-06 | — | Whole AC (invariants.md merge is epic-close paperwork) | TASK-015/016/017/018 |
| AC-008-07 | — | Whole AC (perf harness wiring, separate decision) | Follow-up task |

## Decisions / nuances

- Client-tracked job list, not a new backend "list jobs" endpoint — deliberate, avoids
  unrequested backend surface.
- Single proposal renderer (no kind-based switch) — deliberate YAGNI, add the switch when
  `IngestProposal` actually gains a discriminator.
- E2E network-mocked, not run against `FixtureProvider` live — infra lane not built this pass to
  stay bounded; `FixtureProvider` is ready for whoever picks that up.
- Query page does not render `citations` from the API at all — discovered mid-task; building that
  UI was out of scope (no new features under CONVERGE), so the NL-citation E2E leg is deferred
  rather than built speculatively.

## Missing prerequisites (blocking full AC-008 closure)

- **TASK-015** — BPMN/ArchiMate import (unblocks AC-008-02 mapping row partially, AC-008-04 BPMN
  leg, AC-008-06).
- **TASK-016** — image-to-data (not directly referenced by any deferred AC-008 row, but part of
  the epic's original leg set — still missing).
- **TASK-017** — R2RML/RML structured import (unblocks AC-008-05's `no-DSN-in-RML-config` check,
  AC-008-02 mapping row, AC-008-06).
- **TASK-018** — SKOS merge reconciliation (unblocks AC-008-02 merge side-by-side, AC-008-06).

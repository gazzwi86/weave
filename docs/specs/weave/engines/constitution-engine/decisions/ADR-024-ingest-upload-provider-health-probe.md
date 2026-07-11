---
type: ADR
title: "ADR-024: Ingest upload probes the AI provider synchronously before writing anything"
description: "CE-V1-TASK-013 AC-002-06 (503 on AI-provider-unavailable commits nothing) is
  satisfied by a synchronous provider health probe in the upload route, before the artefact/job
  are written -- extraction itself stays backgrounded per CE-V1-TASK-012's upload budget."
tags: [constitution-engine, adr, ingest, ai, availability]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-024-ingest-upload-provider-health-probe.md
date: 2026-07-11
entity: constitution-engine
---

# ADR-024: Ingest upload probes the AI provider synchronously before writing anything

## Status

Accepted (decided during CE-V1-TASK-013 orientation, team-lead-approved).

## Context

TASK-013's AC-002-06 requires: "when the AI provider is unavailable, ingest returns 503 and
commits nothing." CE-V1-TASK-012's existing upload route (`routers/ingest.py::upload_artefact_route`)
writes the `prov:Entity` artefact and the `ingest_jobs` row, returns 201, then schedules
`run_ingest_job` as a FastAPI `BackgroundTask` — extraction (and therefore any LLM call) happens
*after* the response has already been sent. A provider failure inside the background task can only
ever surface as `job.status = "failed"` on a later poll; it structurally cannot produce a 503 on
the upload response, and by the time it fails the artefact + job rows are already committed --
violating "commits nothing."

Making the whole extraction (including the LLM call) synchronous inside the upload route would fix
this, but blows CE-V1-TASK-012's upload performance budget (<2000ms, QA-verified) and changes the
already-shipped, QA-passed upload/poll contract that TASK-012's frontend and tests depend on.

## Decision

- The upload route gets a cheap, synchronous provider health probe (not a full extraction call)
  before any write (S3 put, artefact entity, job row): if the probe fails, return 503 immediately,
  write nothing.
- Extraction itself (the real per-document LLM call) stays exactly as TASK-012 built it --
  backgrounded via `BackgroundTasks.add_task(run_ingest_job, ...)`, upload budget unaffected.
- This only covers "provider unreachable at upload time." A transient failure that appears later,
  mid-extraction, still surfaces as `job.status = "failed"` (existing TASK-012 behaviour, not a
  503) -- AC-002-06 is scoped to the upload-time check, matching the brief's "AI-unavailable path"
  framing under this task's IN-scope list.

## Consequences

- Upload route gains one new failure mode (503) and one new synchronous call on the hot path --
  must stay cheap (no token generation) to hold the <2000ms budget; a lightweight
  connectivity/health check, not a full `complete()` round trip.
- TASK-012's upload/poll contract, endpoints, and background-task wiring are unchanged.

## Alternatives Considered

- **Make the whole extraction synchronous in the upload route.** Rejected: blows the <2000ms
  upload budget, changes a QA-passed contract for a task that already shipped.
- **Report the failure only via job status (no 503 at all).** Rejected: contradicts the brief's
  explicit AC-002-06 wording ("returns 503"); a background-only failure signal makes it easy for a
  caller to think the artefact was accepted when it silently never will be processed.

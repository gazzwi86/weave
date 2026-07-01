---
type: Task
title: "Task: TASK-003 — Request Studio: Intake Form & AI Spec Drafting (E1-S1)"
description: "Implement the request intake endpoint and streaming AI spec-drafting pipeline grounded in CE-READ-1 — first story of the Request Studio."
tags: [build-engine, 04-arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-001
milestone: M1
created: 2026-07-01
blocked_by: []
unlocks: [TASK-004]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/04-arch/tasks/TASK-003.md
---

# Task: TASK-003 — Request Studio: Intake Form & AI Spec Drafting (E1-S1)

## Story

**Epic:** [EPIC-001 — Request Studio](../../../build-engine.md#epic-001--request-studio)
**Status:** Backlog
**Priority:** Must Have

**As a** product owner
**I want** to describe a build request in natural language and receive an AI-drafted brief/PRD/tech
spec streamed section by section
**So that** I can evaluate scope and completeness before committing resources to a project

> **FRs covered:** FR-001 (intake form + run-mode selector), FR-002 (AI spec drafting via
> `CE-READ-1`, streamed, 60 s timeout, `claude-opus-4-8`).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a `POST /api/requests` is received with a valid JWT, `prompt`, and `run_mode`, THE SYSTEM SHALL create a request record and start the AI spec-drafting pipeline, returning `202` with `{request_id, status: "drafting", stream_url}` | `test_create_request_returns_202_with_stream_url` |
| AC-2 | WHEN the drafting pipeline runs, THE SYSTEM SHALL invoke `CE-READ-1` (pinned to `CE-VERSION-1` latest) to ground the spec before calling the LLM; the SPARQL grounding query and pinned version IRI MUST be recorded in `PLAT-AUDIT-1` | `test_drafting_logs_ce_read_call_to_audit` |
| AC-3 | WHEN the spec draft is in flight, THE SYSTEM SHALL stream sections as Server-Sent Events on `GET /api/requests/{id}/stream`; each event MUST be a JSON object `{section: "brief"|"prd"|"tech_spec", content: "<text>", done: false}` with a final `{done: true}` event | `test_stream_emits_section_sse_events` |
| AC-4 | WHEN the first streamed token arrives, THE SYSTEM SHALL emit it within 5 s of request creation (p95 under single-user load); WHEN the total generation call exceeds 60 s (default timeout, tunable via `PLAT-SETTINGS-1`), THE SYSTEM SHALL terminate the stream, mark the request `timed_out`, preserve the partial draft as `{status: "partial"}`, and fire a `PLAT-NOTIFY-1` `generation_failure` event | `test_stream_times_out_at_60s_and_fires_notify` |
| AC-5 | WHEN an unauthenticated request reaches `POST /api/requests`, THE SYSTEM SHALL return `401` with `{"error": "unauthorised"}` and `Www-Authenticate: Bearer`; no draft is started | `test_create_request_401_without_jwt` |
| AC-6 | WHEN `run_mode` is not one of `draft_spec_only \| spec_to_build \| spike`, THE SYSTEM SHALL return `422` with `{"error": "validation_error", "field": "run_mode", "allowed": ["draft_spec_only", "spec_to_build", "spike"]}` | `test_create_request_422_invalid_run_mode` |
| AC-7 | WHEN `CE-READ-1` is unreachable during grounding, THE SYSTEM SHALL continue with a degraded prompt (no graph context), mark the request with `graph_context: "unavailable"`, and NOT block the draft — the degraded state is visible in `GET /api/requests/{id}` | `test_drafting_degrades_gracefully_when_ce_unreachable` |
| AC-8 | WHEN the LLM is invoked, THE SYSTEM SHALL use only `claude-opus-4-8` for spec drafting; a routing miss (model unavailable) MUST halt the pipeline and return `503 {"error": "model_unavailable"}` | `test_drafting_uses_claude_opus_model_id` |

## Implementation

### Pseudocode

```
function create_request(jwt, prompt, run_mode, description=None):
  # Input gates
  claims = cognito.verify(jwt)            # → 401
  if run_mode not in ALLOWED_RUN_MODES:   # draft_spec_only|spec_to_build|spike
    return 422 with {"error": "validation_error", "field": "run_mode",
                     "allowed": ALLOWED_RUN_MODES}
  if not prompt or not prompt.strip():
    return 422 with {"error": "validation_error", "field": "prompt"}

  tenant_id = claims["custom:tenant_id"]
  request_id = uuid4()

  # Persist request record
  aurora.execute(
    "INSERT INTO requests (id, tenant_id, prompt, run_mode, status, created_at)"
    " VALUES (:id, :t, :p, :rm, 'drafting', now())",
    id=request_id, t=tenant_id, p=prompt, rm=run_mode
  )

  # Kick off async drafting pipeline (background task)
  background_tasks.add_task(run_drafting_pipeline, request_id, tenant_id, prompt, run_mode)

  stream_url = f"/api/requests/{request_id}/stream"
  return 202 with {"request_id": str(request_id), "status": "drafting",
                   "stream_url": stream_url}


async function run_drafting_pipeline(request_id, tenant_id, prompt, run_mode):
  # Ground in CE-READ-1 (degradable)
  graph_context = "unavailable"
  try:
    pinned_version = ce_read_client.get("/api/ontology/versions")["is_latest"]["version_iri"]
    bpmo = ce_read_client.get(f"/api/sparql?version={pinned_version}&...", sparql=GROUNDING_QUERY)
    graph_context = bpmo
    emit_audit("ce_read_grounding", actor=BUILD_SERVICE_PRINCIPAL,
               target=request_id, diff_summary={"version": pinned_version})
  except ConnectionError:
    aurora.update_request(request_id, graph_context="unavailable")
    # continue — degraded mode

  # Stream generation via claude-opus-4-8
  sections = ["brief", "prd", "tech_spec"]
  with timeout(SPEC_DRAFT_TIMEOUT_S):         # default 60, from PLAT-SETTINGS-1
    for section in sections:
      stream = anthropic_client.messages.stream(
        model="claude-opus-4-8",              # hard-coded; routing miss → 503
        prompt=build_section_prompt(section, prompt, graph_context)
      )
      redis_pubsub.publish(f"request:{request_id}",
                           {"section": section, "content": stream.text, "done": False})

  redis_pubsub.publish(f"request:{request_id}", {"done": True})
  aurora.update_request(request_id, status="draft_complete",
                        draft_content=combined_sections)


# SSE stream handler
async function stream_request(jwt, request_id):
  claims = cognito.verify(jwt)    # → 401
  request = aurora.get_request(request_id, tenant_id=claims["custom:tenant_id"])
  if not request: return 404 with {"error": "not_found"}

  async for event in redis_pubsub.subscribe(f"request:{request_id}"):
    yield ServerSentEvent(data=json.dumps(event))
```

### API Contracts

**`POST /api/requests`**

Request body:

```json
{
  "prompt": "string — natural-language description of what to build (required)",
  "run_mode": "string — one of: draft_spec_only | spec_to_build | spike (required)",
  "description": "string | null — optional additional context (optional)"
}
```

Response `202`:

```json
{
  "request_id": "string — UUID",
  "status": "string — always \"drafting\" at creation",
  "stream_url": "string — relative URL for the SSE stream"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 422 | `prompt` absent or empty | `{"error": "validation_error", "field": "prompt"}` |
| 422 | `run_mode` not in allowed set | `{"error": "validation_error", "field": "run_mode", "allowed": ["draft_spec_only", "spec_to_build", "spike"]}` |
| 503 | LLM model unavailable (routing miss) | `{"error": "model_unavailable"}` |

**`GET /api/requests/{request_id}/stream`** — Server-Sent Events

Each SSE event `data` field is a JSON object:

```json
{ "section": "brief | prd | tech_spec", "content": "string", "done": false }
```

Final event:

```json
{ "done": true }
```

**`GET /api/requests/{request_id}`**

Response `200`:

```json
{
  "request_id": "string",
  "status": "string — drafting | draft_complete | timed_out | partial",
  "run_mode": "string",
  "graph_context": "string — version_iri | \"unavailable\"",
  "draft_content": "object | null — null until draft_complete",
  "created_at": "string"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` |
| 404 | Request not found or belongs to another tenant | `{"error": "not_found"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#request-studio-intake-flow` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |
| State | `../tech-spec/business-process.md` | `#request-status-states` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |
| Data Model | `../tech-spec/data-model.md` | `#requests-table` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| Streaming via Server-Sent Events (SSE) over Redis pub/sub | No ADR yet — first decision made here | FastAPI `EventSourceResponse`; Redis ElastiCache as the pub/sub broker between background task and SSE handler |
| LLM: `claude-opus-4-8` for spec drafting | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | Hard-coded model ID in routing table; routing miss → 503, never silent invocation of unapproved model |
| CE-READ-1 grounding degradable (FR-002, FR-007) | [build-engine.md EPIC-001 ACs](../../../build-engine.md#epic-001--request-studio) | Graph unavailability marks `graph_context: "unavailable"` but does NOT block the draft |
| Spec timeout tunable via PLAT-SETTINGS-1 | [contracts.md `PLAT-SETTINGS-1`](../../../../contracts.md#plat-settings-1) | Default 60 s; read at pipeline start from settings cascade; partial draft preserved on timeout |
| Async pipeline via FastAPI BackgroundTasks | No ADR yet — decision here | `BackgroundTasks.add_task()` for pipeline; SSE handler subscribes via Redis; long-running → ECS Fargate pattern for resilience |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 401 when JWT is absent`
- `should return 422 when prompt is empty`
- `should return 422 when run_mode is not in allowed set`
- `should degrade gracefully and continue when CE-READ-1 raises ConnectionError`
- `should return 503 when model_unavailable routing miss occurs`
- `should mark request timed_out and fire PLAT-NOTIFY-1 event when pipeline exceeds 60s`

### Integration Tests (minimum 3)

- `should create request record, stream SSE events with section and done fields`
- `should reject unauthenticated POST /api/requests with 401`
- `should return graph_context "unavailable" in GET when CE-READ-1 is down`

### E2E Tests

N/A — no UI surface in M1; SSE stream verified by integration test.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Integration | `should create request record, stream SSE events with section and done fields` |
| AC-2 | Integration | `should create request record, stream SSE events with section and done fields` |
| AC-3 | Integration | `should create request record, stream SSE events with section and done fields` |
| AC-4 | Unit | `should mark request timed_out and fire PLAT-NOTIFY-1 event when pipeline exceeds 60s` |
| AC-5 | Unit | `should return 401 when JWT is absent` |
| AC-6 | Unit | `should return 422 when run_mode is not in allowed set` |
| AC-7 | Integration | `should return graph_context "unavailable" in GET when CE-READ-1 is down` |
| AC-8 | Unit | `should return 503 when model_unavailable routing miss occurs` |

## Dependencies

- **blocked_by:** []
- **unlocks:** [TASK-004]
- **External prerequisites:** `"Redis ElastiCache instance available in staging"`, `"PLAT-AUDIT-1 emit endpoint available"`, `"PLAT-NOTIFY-1 event endpoint available"`, `"PLAT-SETTINGS-1 settings read endpoint available"`

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~14k input, ~7k output
- **Estimated cost:** ~$0.90 (claude-opus-4-8 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included (3 pending — DoR blockers for tech-spec pass)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided
- [ ] Tech-spec diagrams created (DoR blocker)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-001

## Implementation Hints

- FastAPI's `EventSourceResponse` (from `sse-starlette`) is the standard SSE implementation;
  pair it with an `asyncio.Queue` bridged from Redis subscription to avoid blocking the event loop.
- The grounding SPARQL query for CE-READ-1 should target BPMO nodes directly related to the
  prompt's named concepts — a naïve `SELECT *` will hit the 200-node context cap (OQ-11); apply
  a top-50 relevance filter by proximity before assembling the prompt.
- Wire the 60 s timeout using `asyncio.wait_for` in the background task; on `asyncio.TimeoutError`
  call `aurora.update_request(status="timed_out")` and publish a `done: true` SSE event so the
  client doesn't hang.
- Redis pub/sub channel name: `f"request:{request_id}"` — include the tenant prefix if
  multi-tenant isolation of the channel is required (check platform RLS strategy).
- The `PLAT-AUDIT-1` emit for CE grounding must fire even in degraded mode (record the failure);
  use a fire-and-forget coroutine so the audit emit never blocks the stream.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

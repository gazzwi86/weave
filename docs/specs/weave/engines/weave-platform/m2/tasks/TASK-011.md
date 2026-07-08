---
type: Task Brief
title: "Task: TASK-011 — Generative widget pipeline: prompt bar + SSE stream + budget/meter/audit (E1-S1, E1-S7)"
description: "The SSE generate endpoint (ADR-012): prompt bar (Cmd+K) with role-tailored example
  prompts, budget gate before any model call, typed spec/data/done/error event stream, mid-stream
  cap rollback, token metering, audit, and the ≤1s-to-spec latency contingency."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-001
milestone: M2
created: 2026-07-08
blocked_by: [TASK-010]
unlocks: [TASK-012, TASK-013]
adr_refs: [ADR-012]
---

# Task: TASK-011 — Generative widget pipeline: prompt bar + SSE stream + budget/meter/audit (E1-S1, E1-S7)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-001 Dashboard
**Priority:** Must Have

**As a** workspace member
**I want** to describe the view I need in plain language and watch the widget stream into my
dashboard within a second, with honest named states when anything fails
**So that** I get workspace intelligence without configuration UI, and never a blank,
hallucinated, or budget-busting result.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a user submits a prompt, THE SYSTEM SHALL resolve the tenant AI budget via `PLAT-SETTINGS-1` (3-level cascade) and hard-reject at 100% cap **before any model call** with SSE `error {state: "budget_cap"}` (FR-035; reuses M1 TASK-008 gate — no re-implementation). | integration: `test_budget_gate_blocks_before_model_call` |
| AC-2 | WHEN generation proceeds, THE SYSTEM SHALL emit exactly one `spec` event, then zero-or-more `data` events, then exactly one terminal (`done` or `error`) — the m2-delta §3 order invariant; `done` carries `token_count`. | integration: `test_sse_order_invariant` |
| AC-3 | WHEN the `spec` event is emitted, the client SHALL render the streaming skeleton/header from it; p95 prompt-to-`spec` ≤ 1 s (FR-003). IF the p95 target cannot be met with the agent call in the path, THEN THE SYSTEM SHALL emit a provisional `spec` from the rule-based keyword map (m2-delta §2) and follow with the agent-resolved spec as a spec-replacing refine — same grammar, no client change (ADR-012 contingency, binding). | integration: `test_spec_event_latency_or_provisional_fallback` |
| AC-4 | IF the AI provider is unconfigured/unreachable, THEN THE SYSTEM SHALL emit `error {state: "provider_503"}` and the client SHALL render the defined retryable offline state (matches prototype `LlmBar` 503 handling; FR-003) — never a blank result. | integration: `test_provider_503_named_state` |
| AC-5 | WHEN the budget cap is reached mid-stream, THE SYSTEM SHALL halt generation, emit `error {state: "budget_cap"}` with the E8-S2 cap message, and roll back the partial widget — no partial `widget_instances` row survives (E1-S1 AC). | integration: `test_midstream_cap_halts_and_rolls_back` |
| AC-6 | WHEN the resolver classifies a prompt to a category whose source engine is not GA (deterministic **availability-registry check on the resolved category** — m2-delta §1/§3 gate order; never a keyword guess), THE SYSTEM SHALL emit `error {state: "source_not_ga"}` rendering the "source engine not yet available" state and SHALL NOT fetch any data. `source_not_ga` and `unsatisfiable` are **distinct states**: `unsatisfiable` (TASK-012) means no component/data-shape match; `source_not_ga` means the category is real but its engine is dark (FR-015 vs FR-004). | integration: `test_non_ga_category_distinct_from_unsatisfiable` |
| AC-7 | WHEN generation completes, THE SYSTEM SHALL meter `token_count` on the existing `PLAT-BILLING-1` queue and write a `PLAT-AUDIT-1` entry (actor, `event_type="dashboard.widget.generated"`, prompt_hash) — and emit the OTel span attributes per PRD §2.2 (`prompt_hash`, `component_type`, `data_source_contract`, `token_count`, `latency_ms`, `tenant_id`). | integration: `test_generation_metered_and_audited` |
| AC-8 | WHILE the prompt bar is empty, THE SYSTEM SHALL show 4–6 role-tailored example prompts scoped to available categories only (never a non-GA source); WHEN the user has generated 3 widgets (tunable), THE SYSTEM SHALL hide them (E1-S7, FR-013). Prompt bar opens with Cmd+K and is keyboard-focusable (FR-001). | unit + e2e: `test_example_prompts_scoped_to_ga`, `test_prompt_to_widget_stream` |

## Implementation

### Pseudocode

```text
# Generate endpoint (packages/backend/dashboard/generate.py)
POST /api/dashboard/widgets/generate  { prompt }  -> text/event-stream
  rbac.require(caller, area="dashboard", level="read")            # M1 middleware
  if billing.budget_state(tenant) == AT_CAP:                      # M1 TASK-008 gate, pre-call
      yield sse("error", state="budget_cap", reason=cap_message()); return

  try:
      result = model_router.dashboard_agent.resolve(prompt)       # sonnet; faked in tests
  except ProviderUnavailable:
      yield sse("error", state="provider_503", reason="AI provider unavailable"); return
  # Gate order (m2-delta §3): budget -> resolver -> registry -> fetch.
  # The RESOLVER classifies (category + data shape); the REGISTRY decides GA-ness.
  # No fragile keyword precheck in the gating path.
  if result is SourceNotGA:            # resolved category's engine dark per availability registry
      yield sse("error", state="source_not_ga", reason=result.source_engine); return
  if result is None:                   # no component/data-shape match (TASK-012)
      yield sse("error", state="unsatisfiable", reason=named_reason); return
  spec = result

  validate spec against WidgetSpec JSON schema (m2-delta §3)      # invalid = bug, 500 not stream
  yield sse("spec", spec)
  txn:                                                            # rollback covers AC-5
      row = insert widget_instances(scope='user', owner=caller, spec, status='fresh')
      for chunk in fetch_binding_data(spec):                      # via TASK-010 CE client
          if billing.budget_state(...) == AT_CAP:
              raise MidStreamCap                                  # txn rolls row back
          yield sse("data", chunk)
      update row.last_result, fetched_at
  billing.meter_tokens(tenant, token_count)                       # separate queue, never dropped
  audit.emit(actor=caller, event="dashboard.widget.generated", prompt_hash=sha256(prompt))
  yield sse("done", token_count=token_count, widget_id=row.id)

# Latency contingency (activate ONLY if perf test shows spec-p95 > 1s):
#   yield sse("spec", keyword_table_provisional_spec(prompt)) immediately,
#   then agent spec streams later as a spec-replacing event — grammar unchanged.
#   The keyword table serves ONLY this provisional-spec fallback — it never gates
#   source_not_ga / unsatisfiable (registry + resolver own those, above).

# Prompt bar (packages/frontend/src/dashboard/PromptBar.tsx)
Cmd+K focus; EventSource-style fetch-stream consumer hook useWidgetStream(url, body)
  on "spec"  -> render skeleton (aria-busy) from component library
  on "data"  -> hydrate component
  on "error" -> render named state per m2-delta §6 (retry button where retryable)
EXAMPLE_PROMPTS_BY_ROLE = 4-6 strings per role, each tagged with source category;
  filter by availability.is_ga; hide after user widget count >= 3 (tunable via PLAT-SETTINGS-1)
```

### API Contracts

**Endpoint:** `POST /api/dashboard/widgets/generate` — `{ "prompt": "show me active compliance contraventions by domain" }` → `200 text/event-stream`

```text
event: spec
data: {"component_type":"bar_chart","title":"SHACL contraventions by domain",
       "data_source_contracts":["CE-METRICS-1"],"bindings":{"field":"shacl_errors_by_severity"},
       "column_span":2}

event: data
data: {"rows":[{"severity":"violation","count":3}],"partial":false}

event: done
data: {"token_count":412,"widget_id":"<uuid>"}
```

Terminal error example: `event: error` / `data: {"state":"budget_cap","reason":"Monthly AI budget cap reached (cap resolved at Domain level)."}`
p95: `spec` ≤ 1 s, terminal ≤ 5 s at ≤ 1,000 points (m2-delta §5). 401/403 as HTTP status before the stream opens.

### Diagram References

| Diagram | Notes |
|---------|-------|
| M2 component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — Generate Endpoint → budget gate → Dashboard Agent flow |
| SSE event grammar | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §3 — event table + order invariant |
| Budget enforcement flow (M1) | [`tech-spec/business-process.md`](../../tech-spec/business-process.md) — FR-035 pre-call sequence this task reuses |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Custom SSE on the Platform API; LLM only in Model Router behind the budget gate | ADR-012 | No Vercel AI SDK, no Next.js server-side LLM call; one client stream hook, native fetch-stream |
| Latency contingency: provisional rule-based spec then spec-replacing refine | ADR-012 confidence flag → m2-delta §3 | Keyword table exists ONLY as the provisional-spec source; it never gates GA-ness or satisfiability (registry + resolver own those — AC-6) |
| `source_not_ga` ≠ `unsatisfiable` — registry decides GA, resolver decides satisfiability | m2-delta §2/§3 (red-team fix 2026-07-08) | Two distinct terminal states with distinct renders; conflating them (or keyword-gating either) is a review Blocker |
| Budget/metering/audit reuse M1 machinery | FR-035, PLAT-BILLING-1, PLAT-AUDIT-1 | Import M1 TASK-008/009 services; any re-implementation is a review Blocker |
| Availability registry is the single GA source | m2-delta §1 | Example-prompt filtering and AC-6 short-circuit import the same module TASK-016/017 use |
| SSE route needs a streaming runtime | ADR-012 §Decision 5 | Route pinned to Fargate/ALB (or Lambda response streaming) — coordinate at deploy config, logged in arch-delivery ledger |

## Test Requirements

### Unit Tests (minimum 4)

- `test_non_ga_category_distinct_from_unsatisfiable` — resolver fixture classifying to a Build-sourced category ⟹ `source_not_ga` error event with the engine named and zero data fetches; resolver fixture returning no-match ⟹ `unsatisfiable`; the two never produce each other's state (parametrised, integration-level — sits in the Integration list below)
- `test_example_prompts_scoped_to_ga` — role fixtures ⟹ 4–6 prompts, none tagged to a non-GA category; count ≥ 4 after filtering (catalogue must over-provide)
- `test_widget_spec_schema_rejects_unknown_component` — spec with `component_type="gauge"` fails validation (closed set of 9)
- `test_sse_event_serialisation` — each event type round-trips through its Pydantic model
- `test_prompt_hash_not_prompt_in_spans` — OTel attributes carry `prompt_hash`, never raw prompt text (PII hygiene)

### Integration Tests (minimum 5)

- `test_budget_gate_blocks_before_model_call` — tenant at 100% cap ⟹ `error budget_cap`, model router spy zero calls
- `test_sse_order_invariant` — happy path ⟹ exactly [spec, data*, done]; parametrised error paths ⟹ [error] or [spec, data*, error], never events after terminal
- `test_midstream_cap_halts_and_rolls_back` — cap flips during data streaming ⟹ error event AND no `widget_instances` row persisted
- `test_provider_503_named_state` — model router raises ProviderUnavailable ⟹ `provider_503`, retryable
- `test_generation_metered_and_audited` — done path ⟹ PLAT-BILLING-1 queue message with token_count + PLAT-AUDIT-1 entry with prompt_hash
- `test_spec_event_latency_or_provisional_fallback` — with the faked router at recorded-fixture latency, `spec` arrives ≤ 1 s; contingency branch test: provisional spec then replacing spec, client state consistent

### E2E Tests (minimum 1)

- `test_prompt_to_widget_stream` — Playwright: Cmd+K, type prompt, skeleton ≤ 1 s (aria-busy), widget fills, data-source footer present, backend `widget_instances` row exists (Plugin Law B); example prompts visible when empty and hidden after 3 generations

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_budget_gate_blocks_before_model_call` |
| AC-2 | Integration | `test_sse_order_invariant` |
| AC-3 | Integration | `test_spec_event_latency_or_provisional_fallback` |
| AC-4 | Integration | `test_provider_503_named_state` |
| AC-5 | Integration | `test_midstream_cap_halts_and_rolls_back` |
| AC-6 | Integration | `test_non_ga_category_distinct_from_unsatisfiable` |
| AC-7 | Integration | `test_generation_metered_and_audited` |
| AC-8 | Unit + E2E | `test_example_prompts_scoped_to_ga`, `test_prompt_to_widget_stream` |

## Dependencies

- **blocked_by:** TASK-010 (widget tables, CE client, state matrix, availability registry live there)
- **unlocks:** TASK-012 (intent mapping plugs into `dashboard_agent.resolve`), TASK-013 (refine reuses this stream)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~70K input, ~30K output
- **Estimated cost:** ~$5

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided (incl. txn-rollback shape for mid-stream cap)
- [x] SSE grammar + order invariant pinned (m2-delta §3)
- [x] Latency contingency specified as a testable AC (AC-3), not a vague note
- [x] Budget/meter/audit integration points named (M1 TASK-008/009 modules — reuse, never re-implement)

## Definition of Done Checklist

- [ ] All ACs met
- [ ] Model router spy proves zero LLM calls on the budget_cap path; zero data fetches on source_not_ga
- [ ] No partial widget row on any error path (rollback verified)
- [ ] Raw prompt text absent from spans and audit entries (hash only)
- [ ] `grep -ri "anthropic\|bedrock" packages/frontend/src` → no hits (invariant, m2-delta §10)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add generative widget SSE pipeline with budget gate`

## Implementation Hints

- Use FastAPI `StreamingResponse` with an async generator; wrap the DB work in the generator so `MidStreamCap` unwinds the transaction naturally — do not manage rollback by hand.
- The frontend hook should use `fetch` + `ReadableStream` (not `EventSource` — it can't POST); parse `event:`/`data:` lines with a ~20-line splitter, no SSE library.
- Keep the contingency keyword table as data (keyword → category/component), not code branches — TASK-012's rule table and the provisional-spec fallback both read it; nothing else may.
- Budget re-check cadence during streaming: once per `data` chunk is enough; per-row is waste.
- Abort handling: client `AbortController` on unmount; server generator must tolerate disconnect without leaking the transaction.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

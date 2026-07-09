---
type: Task Brief
title: "Task: TASK-032 — Query & ask v2 — lifecycle states + Graph/Table/Raw results + speech input"
description: "Rebuilds the Constitution 'Query' screen's ask lifecycle (submitting /
  provider-missing / timeout / error / success — never dead air) and result presentation
  (Graph/Table/Raw toggle, always-available 'view SPARQL', grounded-IRI canvas glow, labelled
  version selector, speech input). Bundle R5; closes Blocker F-D18 and Major F-D19."
tags: [constitution-engine, arch, task, v1, design-refit]
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-024
milestone: v1
created: 2026-07-09
blocked_by: [PLAT-V1-TASK-026]
unlocks: []
adr_refs: []
timestamp: 2026-07-09T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-032 — Query & ask v2 — lifecycle states + Graph/Table/Raw results + speech input

> **Scope traceability:** M1 shipped the base NL→SPARQL query surface — `m1/TASK-007` (NL→SELECT
> translation via `POST /api/query/nl`, the raw SPARQL editor, and the `coverage_gap(process)`
> pattern) — **done**. No v1 task has revisited the resulting UI since. The design assessment run
> on 2026-07-09 found the shipped "Ask" surface gives **zero feedback**: no loading state, no
> timeout, no error — 18s+ of dead air with the SPARQL editor never populated, because the
> backend NL provider is likely absent but the UI cannot say so (F-D18, Blocker); and that
> results, when they do render, are table-only with no graph-visual grounding of the answer, an
> unlabeled version field containing "latest", and secondary actions ("Explain this
> query"/"Run coverage gap report") sitting at equal visual weight with Run (F-D19, Major). The
> user's ruling on 2026-07-09 made closing F-D18 a **v1 requirement** (bundle R5,
> `docs/design/v1-design-requirements.md`). This task is the v1 rebuild that closes that gap — it
> does not touch the `POST /api/query/nl` translation logic or the SPARQL sanitiser TASK-007
> already built.

## Story

**Epic:** [EPIC-024](../../../constitution-engine.md#epic-024--query--ask-v2--v1)
**Status:** Backlog · **Priority:** Must Have

**As an** analyst or SME asking a plain-language question about the company model
**I want** to see visible progress while my question is answered, understand exactly why it
failed when it does, and see the answer as a graph, a table, or the raw SPARQL — whichever helps
me trust and go deeper
**So that** I never sit through silent dead air, and I can verify an answer against the graph it
was grounded in rather than taking a table of rows on faith.

Covers FR-018, FR-019 ([constitution-engine.md §2.1](../../../constitution-engine.md#21-functional-requirements)),
EPIC-007 stories E7-S1/E7-S2 (already built by `m1/TASK-007`; this task rebuilds their UI, not
their backend).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|-------------------|--------------|
| AC-1 | WHEN a question is submitted on the ask bar, THE SYSTEM SHALL transition through explicit lifecycle states — `submitting` (visible progress indicator) then `success` (rendered results) — calling CE-READ-1 `POST /api/query/nl {question, version}`, with no interval in which the UI shows nothing. | integration: `test_ask_lifecycle_submitting_to_success_never_dead_air` |
| AC-2 | IF the AI provider is unavailable (`POST /api/query/nl` returns `503`) THEN THE SYSTEM SHALL show a distinct `provider-missing` state with a clear message and 2-3 example questions, AND the SPARQL editor SHALL remain fully functional (FR-018's existing 503-keeps-editor-live contract). | integration: `test_provider_missing_state_shows_examples_editor_stays_live` |
| AC-3 | IF the NL query request exceeds the response timeout (default 15s, tunable) THEN THE SYSTEM SHALL show a distinct `timeout` state with a retry action, visually and textually distinct from the generic `error` state. | integration: `test_timeout_state_distinct_from_generic_error` |
| AC-4 | IF `POST /api/query/nl` returns a non-timeout failure (e.g. `400 {error:"translation_failed"}`) THEN THE SYSTEM SHALL show an `error` state naming what went wrong plus example questions — never an empty result frame. | integration: `test_error_state_names_failure_with_examples` |
| AC-5 | WHEN a query (NL-originated or hand-typed in the SPARQL editor) returns rows, THE SYSTEM SHALL render a result frame with a Graph / Table / Raw toggle defaulting to Table, switching views without re-issuing the query. | integration: `test_result_frame_toggle_graph_table_raw_no_requery` |
| AC-6 | WHILE any result is displayed, THE SYSTEM SHALL show a "View SPARQL" disclosure containing the exact executed SPARQL string, available identically whether the query originated from NL or was hand-typed. | integration: `test_view_sparql_disclosure_always_available_both_origins` |
| AC-7 | WHEN the Graph view is active and the response carries a non-empty `grounded_iris` array, THE SYSTEM SHALL glow the matching nodes on the embedded canvas and dim all non-matching nodes; WHEN `grounded_iris` is empty, THE SYSTEM SHALL dim the whole canvas with a "no grounded matches" note rather than an error or a blank canvas. | integration: `test_grounded_iris_glow_matches_dim_others_and_empty_case` |
| AC-8 | WHERE the version selector is shown, THE SYSTEM SHALL render it as a labelled control (e.g. "Version:") resolved from CE-READ-1 `GET /api/ontology/versions`, defaulting to `latest` — never an unlabeled text input. | integration: `test_version_selector_labelled_and_defaults_latest` |
| AC-9 | WHEN the ask bar's microphone affordance is activated, THE SYSTEM SHALL capture speech via the browser's Web Speech API, transcribe it into the ask input as editable text, and require an explicit Ask action before submission — a transcript SHALL NEVER auto-submit. | integration: `test_speech_input_transcribes_to_editable_text_no_auto_submit` |
| AC-10 | WHILE the SPARQL editor is used as the expert path, THE SYSTEM SHALL render Run as the single visually-primary action with "Explain this query" and "Run coverage gap report" as secondary/ghost actions, and SHALL reject any non-SELECT or `SERVICE`-bearing query before execution (TASK-007's existing sanitiser, unchanged). | integration: `test_sparql_editor_run_is_sole_primary_action_others_secondary` |

## Implementation

### Pseudocode

```text
# packages/frontend/app/constitution/query/page.tsx — container (data-binding only,
# per the atomic-design constraint; presentational markup lives in the design-system templates)

function askQuestion(question, version = "latest"):
  # Input gates
  if not question or question.trim() == "": return 400 with {"error": "empty_question"}

  setState("submitting")                                 # AC-1: visible progress, immediately
  try:
    resp = ce_read.post("/api/query/nl",
                         body={"question": question, "version": version},
                         timeout=15000)                   # AC-3: 15s default, tunable
  catch TimeoutError:
    return setState("timeout", {retry: () => askQuestion(question, version)})  # AC-3
  catch NetworkOrServerError as e:
    if e.status == 503:
      return setState("provider_missing", {examples: EXAMPLE_QUESTIONS})       # AC-2
    return setState("error", {message: describeFailure(e), examples: EXAMPLE_QUESTIONS})  # AC-4

  if resp.status == 400 and resp.body.error == "translation_failed":
    return setState("error", {message: "Couldn't turn that into a query — try rephrasing",
                               examples: EXAMPLE_QUESTIONS})                    # AC-4

  # happy path
  return setState("success", {
    sparql: resp.body.sparql, rows: resp.body.rows, columns: resp.body.columns,
    groundedIris: resp.body.grounded_iris, citations: resp.body.citations or []
  })                                                                            # AC-1

function renderResultFrame(mode, result):
  # AC-5, AC-6 — pure view switch, no network call
  if mode == "graph": return renderGraphView(result.groundedIris, canvasEmbed)
  if mode == "table":  return renderTableView(result.rows, result.columns)
  if mode == "raw":    return renderRawJson(result)
  # "View SPARQL" is a disclosure over result.sparql, available in every mode

function renderGraphView(groundedIris, canvasEmbed):
  # AC-7
  if len(groundedIris) == 0:
    return canvasEmbed.render(dimAll=true, note="No grounded matches for this answer")
  return canvasEmbed.render(glow=groundedIris, dimNonMatching=true)

function onMicActivated():
  # AC-9
  if not browserSupportsSpeechRecognition(): return renderMicUnsupportedTooltip()
  transcript = webSpeechApi.listenOnce()      # browser-native, no server round-trip
  setAskInputValue(transcript)                # editable; user must still press Ask
  return                                       # no auto-submit, ever

function runSparqlEditor(sparqlText, version):
  # AC-10 — unchanged sanitiser call, TASK-007's existing path
  validation = ce_read.sanitiseSelectOnly(sparqlText)     # rejects UPDATE/INSERT/DELETE/SERVICE
  if not validation.ok:
    return 400 with {"error": "disallowed_construct", "construct": validation.found}
  resp = ce_read.get("/api/sparql", params={"query": sparqlText, "version": version, "page": 1})
  return setState("success", {sparql: sparqlText, rows: resp.rows, columns: resp.columns,
                               groundedIris: []})   # hand-typed queries carry no NL grounding
```

### API Contracts

**N/A — no new backend endpoints.** This task is a frontend rebuild consuming the existing
contracts unchanged:

- **CE-READ-1:** `POST /api/query/nl` → `{ sparql, rows, columns, grounded_iris }` (plus the
  optional additive `citations` array per ADR-011) on success; `GET /api/sparql?version=<iri|latest>&page=<n>`
  for the SPARQL editor path; `GET /api/ontology/versions` for the version selector.

Error responses (from CE-READ-1, unchanged by this task):

| Status | Condition | Body |
|--------|-----------|------|
| 400 | NL could not be translated to a valid SPARQL SELECT | `{"error": "translation_failed"}` |
| 400 | Hand-typed query is non-SELECT or contains `SERVICE` | `{"error": "disallowed_construct", "construct": "<name>"}` |
| 401 | Missing/invalid JWT | `{"error": "unauthorised"}` |
| 503 | AI provider unavailable | `{"error": "provider_unavailable"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|-------------------|---------|
| Sequence | [`m1/tasks/TASK-007.md`](../../../m1/tasks/TASK-007.md) | inline Mermaid | The NL→SPARQL translation + SPARQL-editor execution flow this UI now surfaces — unchanged by this task |
| State | — | — | Pending — the new lifecycle states (`submitting`/`provider-missing`/`timeout`/`error`/`success`) have no existing tech-spec diagram; **flagged as a DoR blocker** — add a state diagram to `tech-spec/business-process.md` before implementation starts, or accept this brief's pseudocode as the state contract (architect's call at DoR review). |
| Data Model | N/A | — | This task renders query results; it introduces no new persisted entity |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|----------------------|
| Graph/Table/Raw toggle switches views client-side over one fetched result — never a second query per view | Research pattern 1, `docs/design/research/graph-canvas-ux-patterns.md` (Neo4j Browser) | AC-5's toggle is pure view state; `renderResultFrame` takes no network action |
| Speech input uses the browser's native Web Speech API, not a server-side transcription endpoint | `v1-design-requirements.md` R5 ("speech-input affordance"); no CE-* contract defines server-side transcription | AC-9 has no backend dependency; unsupported browsers get a tooltip, not a broken mic button |
| `citations` field (if present) is read but not required — additive per ADR-011 | [ADR-011](../../decisions/ADR-011.md) | The result-frame schema tolerates the field being absent; this task does not build citation UI (out of scope — R5 does not request it) |
| No task-specific ADR for the backend NL-translation/sanitiser logic — inherited from CE-READ-1 as fixed in contracts.md | [CLAUDE.md](../../../../../../CLAUDE.md#stack-confirmed--final-unless-a-prd-justifies-otherwise) | This task changes no backend contract; it is UI-only |

### Design requirements

- Ask lifecycle states (submitting progress / provider-missing / timeout / error with example
  questions / success — never dead air) — `v1-design-requirements.md` R5; closes Blocker **F-D18**
  (`design-assessment-2026-07-09.md`).
- Result frame with Graph/Table/Raw toggle; "view SPARQL" disclosure always available; grounded
  IRIs glow on canvas with non-matches dimmed; labelled version selector — `v1-design-requirements.md`
  R5; closes Major **F-D19**.
- Speech-input (mic) affordance on the ask bar — `v1-design-requirements.md` R5 (V4 direction).
- SPARQL editor stays the expert path: SELECT-only, versioned, clear Run primary —
  `v1-design-requirements.md` R5.
- Graph/Table/Raw toggle pattern — research pattern 1, `docs/design/research/graph-canvas-ux-patterns.md`
  ("Highest-leverage borrow" from Neo4j Browser).
- JTBD: "ask → visible progress → answer rows + the generated SPARQL (inspectable) + grounding
  highlighted on a mini-canvas; failure states say *why*... and offer example questions" —
  `jtbd.md` §Constitution → Query.
- Atomic-design constraint: the screen consumes `AskBar`, `GlassPanel`, `CanvasLegend` from the
  design-system library; the container (`page.tsx`) binds data only — if a layout this screen
  needs does not exist in the design system yet, it is added there first, not patched locally —
  `visual-direction.md` §Delivery (Advisory pending the design-system task's existence; see
  Dependencies).

## Test Requirements

### Unit Tests (minimum 3)

- `should_classify_503_as_provider_missing_not_generic_error` — response-classification unit:
  a `503` maps to the `provider_missing` state, never the generic `error` state
- `should_never_auto_submit_speech_transcript` — the mic handler sets input value but does not
  invoke the submit action
- `should_toggle_result_view_without_new_fetch` — switching Graph/Table/Raw mutates local view
  state only, no fetch is triggered

### Integration Tests (minimum 5)

- `test_ask_lifecycle_submitting_to_success_never_dead_air`
- `test_provider_missing_state_shows_examples_editor_stays_live`
- `test_timeout_state_distinct_from_generic_error`
- `test_error_state_names_failure_with_examples`
- `test_result_frame_toggle_graph_table_raw_no_requery`
- `test_view_sparql_disclosure_always_available_both_origins`
- `test_grounded_iris_glow_matches_dim_others_and_empty_case`
- `test_version_selector_labelled_and_defaults_latest`
- `test_speech_input_transcribes_to_editable_text_no_auto_submit`
- `test_sparql_editor_run_is_sole_primary_action_others_secondary`

### E2E Tests (minimum 1)

- `test_analyst_asks_question_sees_progress_then_grounded_graph_result` — Playwright: type a
  question, observe the `submitting` state render immediately (no dead air), see the `success`
  state with rows, switch to Graph view, confirm grounded nodes glow and others dim, open "View
  SPARQL", confirm the exact executed query is shown

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration + E2E | `test_ask_lifecycle_submitting_to_success_never_dead_air`, `test_analyst_asks_question_sees_progress_then_grounded_graph_result` |
| AC-2 | Integration + Unit | `test_provider_missing_state_shows_examples_editor_stays_live`, `should_classify_503_as_provider_missing_not_generic_error` |
| AC-3 | Integration | `test_timeout_state_distinct_from_generic_error` |
| AC-4 | Integration | `test_error_state_names_failure_with_examples` |
| AC-5 | Integration + Unit | `test_result_frame_toggle_graph_table_raw_no_requery`, `should_toggle_result_view_without_new_fetch` |
| AC-6 | Integration | `test_view_sparql_disclosure_always_available_both_origins` |
| AC-7 | Integration + E2E | `test_grounded_iris_glow_matches_dim_others_and_empty_case`, `test_analyst_asks_question_sees_progress_then_grounded_graph_result` |
| AC-8 | Integration | `test_version_selector_labelled_and_defaults_latest` |
| AC-9 | Integration + Unit | `test_speech_input_transcribes_to_editable_text_no_auto_submit`, `should_never_auto_submit_speech_transcript` |
| AC-10 | Integration | `test_sparql_editor_run_is_sole_primary_action_others_secondary` |

## Dependencies

```
blocked_by: ["PLAT-V1-TASK-026 — Storybook design-system foundation (visual-direction.md
             §Delivery, ruling R13), authored in the same 2026-07-09 architect pass and tracked
             in progress.json. This task consumes its AskBar, GlassPanel and CanvasLegend
             components and cannot start implementation before they exist."]
unlocks:    []
```

## Cost Estimate

```
Complexity:        M
Estimated tokens:  ~44K input, ~20K output
Estimated cost:    ~$2.90 (claude-fable-5 pricing at time of writing, per CLAUDE.md §Stack)
```

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (N/A — reuses CE-READ-1 unchanged, documented above)
- [ ] Diagram references included — state diagram for the new lifecycle states is **Pending**
  (see Diagram References); DoR blocker until the architect either adds it or accepts this
  brief's pseudocode as the state contract
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined — blocked_by PLAT-V1-TASK-026 (Storybook design-system foundation,
  authored + tracked in the same architect pass) (see
  Dependencies); resolve before implementation starts
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] JSDoc / docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and parent epic

## Implementation Hints

- Reuse TASK-007's SPARQL sanitiser and NL-translation calls verbatim (AC-10) — this task only
  changes what wraps them on the frontend, never the translation or sanitiser logic itself.
- Verify the exact NL-query response field names against the live OpenAPI schema before wiring
  the Graph/Table/Raw toggle: contracts.md's canonical CE-READ-1 shape names the field `sparql`,
  but the M1 implementation (`m1/TASK-007`) used `sparql_generated` — confirm which the deployed
  endpoint actually returns (per the harness's live-CE-VERSION-1 grounding convention) rather than
  trusting either doc blindly.
- The Web Speech API is unavailable in some browsers (notably older Firefox) — `onMicActivated`'s
  unsupported branch must degrade to hiding or disabling the mic affordance, never a silent no-op.
- `# ponytail: timeout default is a flat 15s client-side timer, not a server-negotiated budget —
  upgrade path is reading a server-advertised timeout header if p95 latency data later shows 15s
  is miscalibrated.`
- The `groundedIris` glow/dim in AC-7 should reuse whatever highlight mechanism the Explorer
  canvas already exposes for search-spotlight (per `jtbd.md` §Constitution → Explore) — do not
  build a second highlight primitive.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

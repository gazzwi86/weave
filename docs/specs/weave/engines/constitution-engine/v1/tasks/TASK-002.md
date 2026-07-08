---
type: Task
title: "Task: TASK-002 — Conversational Document Ingest Agent (E12-S1, USER PRIORITY)"
description: "The epic's Must story: upload a BPM/policy/runbook document and review
  agent-proposed, graph-linked additions in the chat panel — confidence-flagged, per-proposal
  HITL, committed via the TASK-001 spine (FR-038)."
tags: [constitution-engine, arch, task, milestone-v1, ingest, agent]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have (within epic)
entity: constitution-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: [TASK-001]
unlocks: [TASK-003, TASK-005, TASK-008]
adr_refs: [ADR-010, ADR-011]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-038, E12-S1) ·
Contracts: [contracts.md](../../../../contracts.md) (CE-WRITE-1, CE-READ-1) · v1 delta:
[v1-delta.md](../../tech-spec/v1-delta.md) §1–§2, §6 · ADR:
[ADR-011](../../decisions/ADR-011.md) (splitter pins 1a — the extractor's structure parse is
what TASK-003's chunker reuses)

## Story

As a business user leaving Bizzdesign/LeanIX/MEGA, I want to upload an existing enterprise
document and have an agent propose additions in the chat panel — linked to what my graph
already holds — so I populate the graph from what I have instead of from a blank page.

## Scope

The document extractor plugin (TASK-001 `Extractor` Protocol, kind=`document`) + the chat-panel
review surface for ingest proposals. IN: per-format simple structure parse (prose
heading/paragraph; ADR-011 pin 1a scope — NO ML layout parsing, NO PDF table reconstruction),
sonnet extraction prompt (consumes FR-044 context; BPMO kinds + relationship vocabulary from
`GET /api/ontology/types`, never hand-copied), find-existing-node linking, confidence scoring +
0.6 flag threshold, chat-panel proposal rendering (op-list, not Turtle), 503 AI-unavailable
path. OUT: embeddings/corpus retrieval (TASK-003), vision (TASK-005), the import page
(TASK-008 — chat is this task's surface).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-002-01 | WHEN the agent processes an uploaded document THE SYSTEM SHALL extract candidate entities + relationships, map them to BPMO kinds fetched from `GET /api/ontology/types` (authoritative — no hard-coded kind list), and emit proposals into the TASK-001 proposal store. |
| AC-002-02 | WHEN a candidate matches an existing node (same-label + same-kind, the M1 find-existing-node flow) THE SYSTEM SHALL propose a link to the existing IRI, not a duplicate (`re-mention-reuses-not-duplicates`). |
| AC-002-03 | WHEN proposals are surfaced in the chat panel THE SYSTEM SHALL render each as a human-readable per-proposal operation list (op-list-not-Turtle, FR-002 principle) with its matched existing resources visible. |
| AC-002-04 | WHEN a proposal's confidence < threshold (default 0.6, read from PLAT-SETTINGS-1 `ingest.confidence_flag_threshold`) THE SYSTEM SHALL flag it "low confidence" for explicit review and never pre-select it for accept. |
| AC-002-05 | WHEN the human accepts/rejects in chat THE SYSTEM SHALL route through TASK-001's accept/reject endpoints — per proposal, no bulk auto-accept — with PROV-O naming the LLM as extracting agent and the human as approver, source doc as `prov:used`. |
| AC-002-06 | WHEN the AI provider is unavailable THE SYSTEM SHALL return `503` with a clear message at job creation, commit NO partial extraction (`503-commits-nothing`), and leave forms/chat authoring live once the provider returns. |
| AC-002-07 | WHEN FR-044 context was captured at upload THE SYSTEM SHALL interpolate it into the extraction prompt (`prompt-receives-pre-ingestion-context` — prompt-assembly unit test). |
| AC-002-08 | WHEN the document has no extractable structure (plain text) THE SYSTEM SHALL still extract over fixed windows (ADR-011 pin 1a fallback applies to the parse) rather than erroring on format. |

## Pseudocode

```text
class DocumentExtractor(Extractor):                    # plugs into TASK-001 worker
    def extract(job):
        text, structure = parse_simple(job.artefact)   # per-format: md/docx/pdf-text/plain
                                                       # heading tree; fallback fixed windows
        prompt = EXTRACT_TEMPLATE.render(
            kinds=ce_read.types(),                     # GET /api/ontology/types, cached
            context=job.context,                       # FR-044
            document=structure)
        for cand in sonnet.call(prompt, tool=propose_entities_tool):   # typed tool output
            cand.confidence = cand.tool_confidence
            yield Candidate(ops=to_ops(cand),          # same Op shape as CE-WRITE-1
                            confidence=cand.confidence,
                            source_span=cand.span)     # locator for TASK-003 citations

chat panel (frontend):
    job status via GET /api/ingest/jobs/{id} (poll)
    render proposals as op-list cards: label, kind, links->existing IRIs, confidence badge
    low-confidence -> amber flag, never pre-checked
    accept/reject buttons -> TASK-001 endpoints; 422 renders violations on the card
```

## API Contracts

Consumes TASK-001's ingest endpoints (v1-delta §2) and **CE-READ-1** `GET /api/ontology/types`
(contracts.md — authoritative kind list). Mutations exclusively via TASK-001 accept →
**CE-WRITE-1**. No new endpoints.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | Doc Extractor Agent position, corpus lookup edge |
| M1 chat authoring flow | [m1 TASK-006](../../m1/tasks/TASK-006.md) diagrams | The chat confirm→CE-WRITE-1 sequence this reuses |
| Splitter/chunking pins | [ADR-011](../../decisions/ADR-011.md) §1/1a | Parse scope guard shared with TASK-003 |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Kinds fetched from `GET /api/ontology/types`, never inlined | Ontology-standards rule — the endpoint is authoritative; hand-copied lists rot | ontology-standards.md |
| Simple structure parse + fixed-window fallback, no ML layout | Scope guard pin 1a; PDF table fidelity is v-later behind evals | ADR-011 (review pin) |
| Chat panel is the E12-S1 review surface (no new page) | Story text says "through the chat panel"; import page (TASK-008) serves the structured stories | engine spec E12-S1 |
| Extraction prompt returns typed tool output, not free text | Tool schema = the CE-WRITE-1 `Op` shape; no free-text parsing layer | contracts.md CE-WRITE-1 |
| **Citation/source rendering in chat cards: proposal cards show the source span (locator) they came from** | Product surface — presented to coordinator/human with this batch; format = ADR-011 locator (page/heading-path) | ADR-011 §4, HITL this batch |

## Test Requirements

Minimum: 4 unit, 4 integration, 1 E2E.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should assemble prompt with FR-044 context fields when present (`prompt-receives-pre-ingestion-context`) | AC-002-07 |
| Unit | should map tool output to CE-WRITE-1 Op shape (incl. local refs for new nodes) | AC-002-01 |
| Unit | should flag candidate below settings threshold, never pre-select | AC-002-04 |
| Unit | should fall back to fixed-window parse on structureless text | AC-002-08 |
| Integration | should link re-mentioned entity to existing IRI, not duplicate (seeded graph) (`re-mention-reuses-not-duplicates`) | AC-002-02 |
| Integration | should 503 at job creation and commit nothing when LLM mock is down (`503-commits-nothing`) | AC-002-06 |
| Integration | should carry LLM extractor + human approver + prov:used through accept | AC-002-05 |
| Integration | should fetch kinds from /api/ontology/types (spy: no static kind list) | AC-002-01 |
| E2E (Playwright) | upload doc → proposals render as op-list cards with links + confidence badges → accept one/reject one → CE-READ-1 shows accepted entity, PROV activity correct | AC-002-01..05 |

## Dependencies

- **blocked_by**: TASK-001 (spine: upload, proposal store, accept path)
- **unlocks**: TASK-003 (chunker reuses this parse), TASK-005 (vision variant of this flow),
  TASK-008 (E2E rides this surface)

## Cost Estimate

**L** — est. **700k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). Prompt engineering + typed tool
schema + frontend chat cards + the E2E; LLM-fixture recording adds test overhead. USER PRIORITY
story — budget generously.

## DoR Checklist

- [x] Proposal flow + endpoints exist (TASK-001)
- [x] Confidence default + settings key pinned (v1-delta §6; OQ-18 stays open, tunable)
- [x] Parse scope pinned (ADR-011 pin 1a)
- [x] Kind source pinned (`GET /api/ontology/types`, ontology-standards)
- [ ] TASK-001 merged (DAG)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass incl. E2E asserting backend state (Law B)
- [ ] Named tests exist verbatim: `re-mention-reuses-not-duplicates`, `503-commits-nothing`, `prompt-receives-pre-ingestion-context`
- [ ] No hard-coded kind list, no literal 0.6 outside settings defaults (invariants delta)
- [ ] Chat cards pass axe zero-violations + keyboard nav (WCAG 2.1 AA, M1 gate)
- [ ] Coverage ≥ 80%, mutation ≥ 60%; Law E budgets

## Implementation Hints

- Reuse the M1 chat proposal-card components (m1 TASK-006) — ingest cards are the same op-list
  rendering plus a confidence badge and source-span line; do not fork the component.
- Record LLM fixtures per document fixture (Law F) — one golden BPM doc, one policy doc, one
  structureless text file.
- `parse_simple`: markdown/docx via existing libs; PDF via text extraction only (pin 1a — no
  layout model). Keep the heading tree because TASK-003's chunker consumes it.
- Pitfall: candidate `source_span` locators must survive into the proposal row now — TASK-003's
  citations and the chat source line both read them; retrofitting locators later means
  re-extraction.
- Pitfall: `to_ops` must emit local `ref`s for new nodes so intra-batch edges resolve (CE-WRITE-1
  Op semantics) — one proposal = one self-contained batch.

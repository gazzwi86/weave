---
type: Task
title: "Task: TASK-016 — AI Diagram / Image-to-Data Ingest"
description: "E12-S3 (FR-040): vision-model extraction of BPMO entities + relationships from
  uploaded diagrams/images, routed through the same per-proposal review + CE-WRITE-1 commit
  flow as E12-S1; unreadable image proposes nothing."
tags: [constitution-engine, arch, task, milestone-v1, ingest, vision]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: [TASK-013]
unlocks: [TASK-019]
adr_refs: [ADR-010, ADR-011]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-040, E12-S3) ·
Contracts: [contracts.md](../../../../contracts.md) (CE-WRITE-1) · v1 delta:
[v1-delta.md](../../tech-spec/v1-delta.md) §1–§2, §6

## Story

As a user whose process knowledge lives in diagrams (whiteboard photos, Visio exports, slide
figures), I want to upload an image and review vision-extracted entity/relationship proposals,
so diagram knowledge enters the graph through the same trusted review flow as documents.

## Scope

The vision extractor plugin (TASK-012 Protocol, kind=`image`) — a variant of TASK-013's
extractor with an image prompt instead of a text parse. IN: sonnet vision call with the same
typed `propose_entities` tool schema, FR-044 context interpolation, same confidence gating
(0.6 via settings), same find-existing-node linking, unreadable-image error path. Chat review
surface is TASK-013's (proposal cards render identically — source line shows the image
filename). OUT: OCR pipelines, diagram-notation auto-detection (a BPMN *file* is TASK-015; this
task is pixels).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-005-01 | WHEN the vision model processes an uploaded image (PNG/JPEG/WebP ≤ 25 MB) THE SYSTEM SHALL propose BPMO entities + relationships through the same per-proposal review + CE-WRITE-1 commit flow as E12-S1 (kinds from `GET /api/ontology/types`, ops in CE-WRITE-1 shape, matches via find-existing-node). |
| AC-005-02 | WHEN extraction confidence < threshold (settings `ingest.confidence_flag_threshold`, default 0.6) THE SYSTEM SHALL flag the proposal for explicit review, never pre-select. |
| AC-005-03 | WHEN the vision model cannot parse the image (unreadable/unsupported content) THE SYSTEM SHALL fail the job with a clear error, propose nothing, and commit nothing. |
| AC-005-04 | WHEN the AI provider is unavailable THE SYSTEM SHALL return 503 at job creation with no partial commit (same `503-commits-nothing` behaviour as E12-S1). |
| AC-005-05 | WHEN an accepted image proposal commits THE SYSTEM SHALL attribute the vision model as extracting agent, human as approver, image artefact as `prov:used`. |
| AC-005-06 | WHEN an unsupported file type is uploaded as `image` THE SYSTEM SHALL 422 at upload with a clear message (boundary validation). |

## Pseudocode

```text
class VisionExtractor(Extractor):            # thin sibling of DocumentExtractor
    def extract(job):
        img = load_validated_image(job.artefact)     # type/size checked at upload
        prompt = VISION_TEMPLATE.render(kinds=ce_read.types(), context=job.context)
        result = sonnet.vision_call(img, prompt, tool=propose_entities_tool)  # same tool
        if result.unparseable: raise UnreadableImage(result.reason)  # -> job failed, 0 proposals
        for cand in result.candidates:
            yield Candidate(ops=to_ops(cand), confidence=cand.tool_confidence,
                            matches=find_existing_node(cand.label, cand.kind),
                            source_span=None)        # images have no text locator
```

## API Contracts

No new endpoints — TASK-012 spine + TASK-013 chat cards. Mutation: **CE-WRITE-1** only.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | Vision Extractor position (worker, LLM lane) |
| E12-S1 flow (shared) | [TASK-013](TASK-013.md) pseudocode + m1 TASK-006 diagrams | The review flow this reuses unchanged |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Same tool schema + review flow as E12-S1, zero new surface | The story's AC literally says "same per-proposal review + CE-WRITE-1 commit flow"; a vision-specific flow would be a second path | engine spec E12-S3 |
| `source_span=None` for images (no passage locator) | Pixels have no heading path; the citation source line degrades to filename — corpus embedding of images is out (text passages only, ADR-011) | ADR-011 §1 |
| Unreadable ⟹ failed job, not empty success | FR-040 failure AC: clear error, nothing proposed | engine spec FR-040 |

## Test Requirements

Minimum: 3 unit, 3 integration, E2E rides TASK-019.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should render vision prompt with kinds + FR-044 context | AC-005-01 |
| Unit | should map unreadable-result to failed job with reason, zero candidates | AC-005-03 |
| Unit | should flag sub-threshold candidate, never pre-select | AC-005-02 |
| Integration | should propose→review→commit with vision-model prov attribution (recorded fixture) | AC-005-01/05 |
| Integration | should 503 + commit nothing when provider mock down | AC-005-04 |
| Integration | should 422 unsupported file type at upload | AC-005-06 |

## Dependencies

- **blocked_by**: TASK-013 (tool schema, `to_ops`, chat cards, confidence gating all exist there
  — this task must reuse, not fork)
- **unlocks**: TASK-019

## Cost Estimate

**S** — est. **250k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). A thin sibling extractor + vision
prompt + fixtures; everything heavy is inherited.

## DoR Checklist

- [x] Shared flow + tool schema exist (TASK-013)
- [x] Threshold settings key pinned (v1-delta §6)
- [x] Vision model = sonnet (two-tier model policy, CLAUDE.md stack)
- [ ] TASK-013 merged (DAG)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass; vision fixtures recorded (one clean process diagram, one unreadable image)
- [ ] No forked review/commit code — diff shows extractor + prompt only
- [ ] Coverage ≥ 80%, mutation ≥ 60%; Law E budgets

## Implementation Hints

- Fixtures: a simple flowchart PNG (5–8 boxes) as the happy path; a photo of static as the
  unreadable case. Record the vision responses once (Law F).
- Image validation at upload: check magic bytes, not extension (trust boundary).
- Pitfall: don't let the model "describe" an unreadable image into low-confidence noise — the
  tool schema needs an explicit `unparseable` escape so AC-005-03 is a clean failure, not 30
  junk proposals at 0.2 confidence.

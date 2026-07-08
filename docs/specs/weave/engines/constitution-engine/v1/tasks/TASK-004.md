---
type: Task
title: "Task: TASK-004 — Structured Model Import: ArchiMate Exchange Format + BPMN"
description: "E12-S2 (FR-039): deterministic converters from ArchiMate Exchange XML and BPMN
  (BBO) to RDF, element-type→BPMO kind mapping shipped as versioned data, per-notation
  well-formedness SHACL, unmapped→Concept flagged, partial-commit skip-and-report."
tags: [constitution-engine, arch, task, milestone-v1, ingest, archimate, bpmn]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: [TASK-001]
unlocks: [TASK-007, TASK-008]
adr_refs: [ADR-010]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-039, E12-S2) ·
Contracts: [contracts.md](../../../../contracts.md) (CE-WRITE-1) · v1 delta:
[v1-delta.md](../../tech-spec/v1-delta.md) §3 (mapping tables — **canonical for this task**,
shipped as versioned mapping data; a Fable ontology-review amendment may update rows without
changing this brief), §4 (well-formedness SHACL) · ADR: [ADR-010](../../decisions/ADR-010.md)

## Story

As an EA/BPM practitioner leaving Bizzdesign/LeanIX/MEGA, I want to import my ArchiMate
Exchange or BPMN files and get BPMO-mapped graph proposals, so my existing models seed the
graph without manual re-entry.

## Scope

Two deterministic (no-LLM) extractor plugins on the TASK-001 spine: ArchiMate Exchange XML and
BPMN 2.0 XML (BBO basis). IN: XML parse → intermediate RDF → per-notation well-formedness SHACL
(v1-delta §4) → kind mapping from the versioned mapping file (v1-delta §3) → proposals (one per
element/relationship group). Unmapped → `Concept` flagged (settings
`ingest.unmapped_kind_default`). These paths are LLM-independent — they stay live when AI is
down. OUT: diagram images (TASK-005), cross-notation merge (TASK-007), any visual mapping UI.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-004-01 | WHEN a well-formed ArchiMate Exchange or BPMN file is imported THE SYSTEM SHALL convert it to RDF, map element types per the versioned mapping file (BPMN task→Activity, event→Event, ArchiMate application-component→System, etc. — v1-delta §3 canonical), and materialise accepted proposals through CE-WRITE-1 (`BPMN-task-maps-to-Activity` + one test per mapping-row group). |
| AC-004-02 | WHEN an element type has no mapping THE SYSTEM SHALL import it as the configured default kind (`Concept`), flag it for review, and list it — never silently drop. |
| AC-004-03 | WHEN a file fails its notation's well-formedness SHACL shape THE SYSTEM SHALL reject the whole file before any commit with per-element reasons (`malformed-file-commits-nothing`). |
| AC-004-04 | WHEN a well-formed file contains elements that fail tenant SHACL at commit THE SYSTEM SHALL commit the valid elements and report skipped ones with reasons (skip-and-report, per FR-039). |
| AC-004-05 | WHEN relationships are converted THE SYSTEM SHALL map them per the relationship table (Assignment→performedBy, Composition→partOf, Triggering→triggeredBy, …; BPMN lane containment→performedBy; sequence flow→hasStep ordering) with unmapped relationships imported as `describes` + flag. |
| AC-004-06 | WHEN converted elements re-mention existing graph entities THE SYSTEM SHALL link via find-existing-node (same-label + same-kind), not duplicate — same rule as every ingest path. |
| AC-004-07 | WHEN the AI provider is down THE SYSTEM SHALL still run these imports end-to-end (deterministic path — no LLM dependency). |
| AC-004-08 | WHEN mapping produces provenance THE SYSTEM SHALL attribute the converter (not an LLM) as extracting agent, human as approver, file as `prov:used`. |

## Pseudocode

```text
class ArchimateExtractor(Extractor):        # BpmnExtractor mirrors it
    def extract(job):
        model = parse_exchange_xml(job.artefact)        # stdlib/defusedxml
        ir = to_intermediate_rdf(model)                 # element/rel triples, notation ns
        report = shacl_validate(ir, ArchimateImportShape)   # v1-delta §4, framework graph
        if report.violations: fail_job(per_element(report)) # whole-file reject
        mapping = load_mapping("archimate", version=latest) # versioned data file
        for element in model.elements:
            kind = mapping.get(element.type) or (settings.unmapped_default, flag=True)
            yield Candidate(ops=make_node_ops(element, kind),
                            confidence=1.0,             # deterministic — never LLM-flagged
                            matches=find_existing_node(element.name, kind),
                            reason=flag_reason_if_unmapped)
        for rel in model.relationships:
            yield Candidate(ops=make_edge_ops(rel, mapping.rels), ...)
```

## API Contracts

No new endpoints — rides TASK-001's spine (upload with `kind=archimate|bpmn` detection,
proposals, accept via CE-WRITE-1). Mutation: **CE-WRITE-1** only (contracts.md).

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | Notation Converters position (worker, deterministic lane) |
| Mapping tables | [v1-delta.md](../../tech-spec/v1-delta.md) §3 | Full element + relationship tables (canonical, versioned data) |
| Well-formedness shapes | [v1-delta.md](../../tech-spec/v1-delta.md) §4 | Whole-file-reject vs skip-and-report split |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Mapping shipped as versioned data file, not code branches | Fable ontology review can amend rows without code change; tunable per epic note | v1-delta §3 |
| Whole-file reject on notation SHACL, skip-and-report on tenant SHACL | Malformed file = user error to fix; failing elements in a valid file = partial value preserved | FR-039 AC, v1-delta §4 |
| Deterministic confidence 1.0, no 0.6 gating | Confidence gating exists for LLM extraction; converters are exact — flags come from unmapped types only | engine spec E12-S2 |
| ArchiMEO/archimate2rdf as reference, not dependency | Epic technical note — prior art informs the mapping file, no new dep | engine spec §Technical notes |

## Test Requirements

Minimum: 5 unit, 4 integration.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should map BPMN task→Activity (`BPMN-task-maps-to-Activity`) + table-driven test over every mapping-row group (both notations) | AC-004-01/05 |
| Unit | should map unmapped element to Concept with flag + review reason | AC-004-02 |
| Unit | should order lane-contained activities with performedBy + hasStep | AC-004-05 |
| Unit | should split Serving by endpoint kinds — System-serves-Service emits `service runsOn system` (subject = the service, never inverted); other pairs emit consumer `dependsOn` provider (`serving-split-direction-canary`, Fable review 2026-07-08) | AC-004-05 |
| Unit | should emit `service runsOn system` for component-realizes-service (hosted-as-subject canary) | AC-004-05 |
| Unit | should parse Exchange XML with external-entity resolution disabled (defusedxml) | AC-004-01 |
| Unit | should load mapping by version (amended file picked up without code change) | AC-004-01 |
| Integration | should reject malformed file whole with per-element reasons, store untouched (`malformed-file-commits-nothing`) | AC-004-03 |
| Integration | should commit valid elements and report skipped on tenant-SHACL failures | AC-004-04 |
| Integration | should link re-mentioned entity, not duplicate (seeded graph) | AC-004-06 |
| Integration | should run end-to-end with LLM mock down (deterministic lane) | AC-004-07 |

## Dependencies

- **blocked_by**: TASK-001 (spine)
- **unlocks**: TASK-007 (cross-notation reconciliation needs ≥ 2 notations landing), TASK-008

## Cost Estimate

**M** — est. **450k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). Two XML parsers + mapping loader +
two SHACL shapes; table-driven tests keep the mapping surface cheap.

## DoR Checklist

- [x] Mapping tables pinned (v1-delta §3; Fable row-level amendments are data-only)
- [x] Well-formedness semantics pinned (v1-delta §4)
- [x] Unmapped default + settings key pinned (v1-delta §6)
- [ ] TASK-001 merged (DAG)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass; named tests verbatim: `BPMN-task-maps-to-Activity`, `malformed-file-commits-nothing`
- [ ] Mapping file versioned + loaded at runtime (no inlined table in code)
- [ ] XML parsing hardened (no external entities/DTD — security rule: validate at boundary)
- [ ] Coverage ≥ 80%, mutation ≥ 60%; Law E budgets

## Implementation Hints

- Use `defusedxml` for both parsers — Exchange files are untrusted input (XXE at a trust
  boundary is in-scope security, not optional).
- The intermediate RDF keeps original notation types as annotations (`weave:sourceType
  "archimate:Serving"`) so review cards can show what a flagged mapping came from — and
  TASK-007's reconciler can trace cross-notation origins.
- Fixtures: one small real-world Exchange file + one BPMN file per happy path; hand-broken
  copies for the SHACL reject tests. Archi (open-source) exports Exchange format for fixture
  authoring.
- Pitfall: BPMN subProcess is both a Process and a step of its parent — emit `partOf` + parent
  `hasStep`, don't pick one.
- Pitfall: mapping file rows may be amended post-Fable-review — tests must be table-driven off
  the mapping file itself, not literal expectations duplicated in test code (except the named
  `BPMN-task-maps-to-Activity` canary).

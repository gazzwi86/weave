---
type: Task
title: "Task: TASK-004 — BE-SDK-1 Generator Core: Fetch → IR → TS/Python/OpenAPI Emitters (E8-S5, FR-059)"
description: "Implement the deterministic SDK generation pipeline per ADR-006: fetch pinned
  SHACL shapes + CE-FUNCTION-1 JSON-Schema projections + CE-BRAND-1 closed-core tokens, normalise
  into one Pydantic IR, emit TypeScript + Python + OpenAPI 3.1 via Jinja2, validate, atomic
  staging. Trigger API and breaking-ack land in TASK-005."
tags: [build-engine, arch, task, m2]
status: Backlog
priority: Should Have
entity: build-engine
epic: EPIC-008
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: [TASK-005]
adr_refs: [ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m2/tasks/TASK-004.md
---

# Task: TASK-004 — BE-SDK-1 Generator Core: Fetch → IR → TS/Python/OpenAPI Emitters (E8-S5, FR-059)

## Story

**Epic:** [EPIC-008 — App Generation](../../../build-engine.md#epic-008)
**Status:** Backlog · **Priority:** Should Have

**As a** client engineering team
**I want** a typed TS + Python SDK and an OpenAPI 3.1 contract generated from our pinned
ontology version
**So that** we work the graph through ontology-derived classes and typed function bindings
instead of hand-written SPARQL/HTTP

> **FRs covered:** FR-059 core pipeline (fetch → IR → emit → validate → stage). Out of scope
> here (TASK-005): the trigger API, `breaking:true` ack flow, ScmDriver commit, provenance
> header stamping, regeneration bookkeeping. **This task delivers the pipeline as a callable
> with golden-file tests; M2 exit criterion 2 is jointly closed with TASK-005.**

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the pipeline runs twice against the same pinned fixture inputs, THE SYSTEM SHALL emit byte-identical output (excluding the provenance timestamp placeholder) | `should emit identical SDK for identical pinned inputs` |
| AC-2 | WHEN a SHACL node shape is fetched, THE SYSTEM SHALL map it to one typed class per language with typed fields carrying datatype and cardinality from the shape's property constraints (`sh:or` → union type) | `should map node shape to typed class with cardinality` |
| AC-3 | WHEN a SHACL constraint cannot be mapped, THE SYSTEM SHALL fail generation with an error naming the shape and constraint — never emit a silent `Any`/`unknown` fallback | `should fail naming shape on unmappable constraint` |
| AC-4 | WHEN the function registry is fetched, THE SYSTEM SHALL emit one typed method per `CE-FUNCTION-1` function from its derived JSON Schema, whose body raises `NotExecutableUntilPostV1(fn_iri)` (execution is post-v1, CE ADR-009) | `should generate one typed method per registry function` |
| AC-5 | WHEN CE-BRAND-1 tokens are fetched, THE SYSTEM SHALL emit typed theme constants from the closed core only (`color`, `typography`, `spacing`, `radius`); `extensions` pass through as an untyped map | `should type closed-core tokens only` |
| AC-6 | WHEN any fetch fails (CE-READ-1 unreachable, shape unresolvable, function endpoint down), THE SYSTEM SHALL fail atomically before emit with the failing input named — no partial staging output | `should fail atomically naming unreachable input` |
| AC-7 | WHEN emit completes, THE SYSTEM SHALL run validators (tsc --noEmit, mypy --strict, OpenAPI 3.1 schema lint) over the staging dir and fail generation on any validator error | `should fail generation when emitted TS does not compile` |
| AC-8 | WHEN a named SPARQL SELECT is present in the pinned inputs, THE SYSTEM SHALL emit a typed query method on the relevant class/client | `should emit typed query method for named select` |

## Implementation

### Pseudocode

```
function generate_sdk(pin: CeVersionPin) -> StagingDir:
  # 1. FETCH (all-or-nothing — AC-6)
  shapes    = ce_client.shapes(version=pin.version_iri)          # CE-READ-1
  functions = ce_client.get("/api/functions")                    # CE-FUNCTION-1 list
  fn_schemas = [ce_client.get(f"/api/functions/{f.fn_iri}") for f in functions]
  tokens    = ce_client.get("/api/brand/tokens")                 # closed core (AC-5)
  selects   = ce_client.named_selects(version=pin.version_iri)

  # 2. IR (single mapping site — ADR-006)
  ir = SdkModel(
    classes   = [map_shape(s) for s in shapes],       # raises UnmappableConstraint(shape, constraint) — AC-3
    functions = [map_fn(f) for f in fn_schemas],      # JSON Schema → typed sig (AC-4)
    queries   = [map_select(q) for q in selects],     # AC-8
    theme     = map_core_tokens(tokens),              # closed core only (AC-5)
    pin       = pin)

  # 3. EMIT (Jinja2; three template sets)
  staging = mkdtemp()
  emit(ir, templates="typescript", into=staging / "ts")
  emit(ir, templates="python",     into=staging / "py")
  emit(ir, templates="openapi",    into=staging / "openapi")

  # 4. VALIDATE (AC-7)
  run("tsc --noEmit", cwd=staging/"ts")     # non-zero → GenerationValidationError
  run("mypy --strict", cwd=staging/"py")
  openapi_lint(staging / "openapi" / "openapi.yaml")
  return staging          # caller (TASK-005) stamps provenance + commits atomically
```

Mapping table (IR core — the authoritative subset; extend only via named errors):

| SHACL | TS | Python |
|---|---|---|
| `sh:NodeShape` | `class` / `interface` | Pydantic `BaseModel` |
| `sh:datatype xsd:string/int/boolean/dateTime` | `string/number/boolean/string(ISO)` | `str/int/bool/datetime` |
| `sh:datatype xsd:decimal/double` | `number` | `Decimal` / `float` |
| `sh:datatype xsd:date` | `string(ISO date)` | `date` |
| `sh:datatype xsd:anyURI` | `string` | `AnyUrl` (Pydantic) |
| `sh:minCount 1` + `sh:maxCount 1` (required single-valued — the most common shape) | `T` (required) | `T` (required field) |
| `sh:maxCount 1` absent | `T[]` | `list[T]` |
| `sh:minCount 0` (or absent) + `sh:maxCount 1` | optional `?` | `T \| None` |
| `sh:minCount 1`, `sh:maxCount` absent | non-empty `T[]` (runtime min-length check) | `list[T]` + `Field(min_length=1)` |
| `sh:or (A B)` | `A \| B` | `A \| B` |
| `sh:in (v1 v2 ...)` | literal union `"v1" \| "v2"` | `Literal["v1", "v2"]` |
| `sh:node <Shape>` / `sh:class <Kind>` | reference type | reference type |
| `sh:pattern` | `string` + runtime regex validation | `str` + `Field(pattern=...)` |
| anything else | `UnmappableConstraint` error | `UnmappableConstraint` error |

### API Contracts

No public endpoint in this task (TASK-005 adds the trigger). Consumes (cite only): CE-READ-1
shapes/named-selects, `GET /api/functions` + `GET /api/functions/{iri}` (contracts.md
§CE-FUNCTION-1), `GET /api/brand/tokens` (§CE-BRAND-1). Pipeline budget: ≤ 5 min p95
end-to-end (m2-delta §7).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Component | `../../tech-spec/m2-delta.md` | §2 diagram | SDK Generator (Fargate family) → ce_client + ScmDriver |
| Decision | `../../decisions/ADR-006.md` | whole file | Pipeline shape, IR rationale, alternatives |
| Contract | `../../../../contracts.md` | §BE-SDK-1 | Ontology→type mapping obligations |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Zero LLM in emit path | [ADR-006](../../decisions/ADR-006.md) §1 | Plain Python; invariants.md verify-by greps for anthropic/bedrock — keep them out of the package |
| One IR, three emitters | [ADR-006](../../decisions/ADR-006.md) §2 | All mapping logic in `map_*`; emitters are dumb templates |
| Unmappable ⇒ named error | [ADR-006](../../decisions/ADR-006.md) / m2-delta §5 | No `Any` fallback branch anywhere in the mapper |
| Function methods raise `NotExecutableUntilPostV1` | CE ADR-009 (M2 = definition surface; execution is post-v1) | Bodies raise typed error with fn_iri; do NOT implement invocation |
| Validators are part of generation | [ADR-006](../../decisions/ADR-006.md) §3 | A validator failure is a generation failure, not a warning |

## Test Requirements

### Unit Tests (minimum 8)

- `should map node shape to typed class with cardinality`
- `should map required single-valued property to required field` (minCount 1 + maxCount 1)
- `should map sh:in to literal union`
- `should fail naming shape on unmappable constraint`
- `should type closed-core tokens only`
- `should map sh:or to union type`
- `should map minCount 0 to optional`
- `should emit typed query method for named select`

### Integration Tests (minimum 4)

- `should emit identical SDK for identical pinned inputs` (golden-file, run twice, byte diff)
- `should generate one typed method per registry function` (fixture registry via CE stub)
- `should fail atomically naming unreachable input` (CE stub down mid-fetch; staging dir empty)
- `should fail generation when emitted TS does not compile` (poisoned template fixture)

### E2E Tests

N/A — no UI; the generated-output compile checks (tsc/mypy in integration lane) are the
functional proof (Law B for non-UI: produced artefact exercised by real toolchain).

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should emit identical SDK for identical pinned inputs` |
| AC-2 | Unit | `should map node shape to typed class with cardinality` |
| AC-3 | Unit | `should fail naming shape on unmappable constraint` |
| AC-4 | Integration | `should generate one typed method per registry function` |
| AC-5 | Unit | `should type closed-core tokens only` |
| AC-6 | Integration | `should fail atomically naming unreachable input` |
| AC-7 | Integration | `should fail generation when emitted TS does not compile` |
| AC-8 | Unit | `should emit typed query method for named select` |

## Dependencies

- **blocked_by:** []
- **unlocks:** [TASK-005]
- **External prerequisites:** CE M2 function endpoints + brand tokens live (committed CE M2
  scope; stubbed in all tests); `tsc`, `mypy` in the generator execution image

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~20k input, ~10k output
- **Estimated cost:** ~$0.75 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode + mapping table provided
- [x] API contracts defined (consumed contracts cited; no new endpoint)
- [x] Diagram references included
- [x] Design decisions noted (ADR-006, CE ADR-009)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (golden files committed as fixtures)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] No `anthropic|bedrock|agentcore` import in the generator package (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-008

## Implementation Hints

- Golden-file discipline: commit the full expected staging tree for the fixture graph; the
  identical-output test is `dircmp` + byte diff. Timestamp placeholder (`{{GENERATED_AT}}`)
  stays a placeholder in golden files — TASK-005 stamps it at commit time.
- Keep `map_shape` a pure function shape→IRClass; the mapping table above is the whole spec —
  resist handling SHACL features the fixture doesn't exercise (add named errors instead).
- Jinja2 `StrictUndefined` everywhere — an undefined template variable must be a loud failure,
  not an empty string in generated client code.
- OpenAPI emitter wraps CE-READ-1/CE-WRITE-1 as the *client-facing* graph surface — it is NOT a
  copy of CE's own API spec (contracts.md §BE-SDK-1(b)); one path per generated class
  (`/graph/{kind}`) + the apply-operations passthrough.
- `mkdtemp` under the run workspace, not `/tmp` — the Fargate task's workspace is the cleanup
  boundary.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

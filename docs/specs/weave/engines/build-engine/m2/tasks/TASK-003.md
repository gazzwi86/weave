---
type: Task
title: "Task: TASK-003 — BPMO Retrieval Under 200-Node Cap + Investigator Runs (ADR-005, FR-051)"
description: "Implement the deterministic seed + weighted k-hop retrieval pipeline for prompt
  assembly (ADR-005, closes OQ-11) and the read-only investigator overflow path (FR-051):
  Sandbox-class principal, no sub-spawn, ≤500-token summary to tenant store."
tags: [build-engine, arch, task, m2]
status: Backlog
priority: Should Have
entity: build-engine
epic: EPIC-011
milestone: M2
created: 2026-07-08
blocked_by: [TASK-001]
unlocks: []
adr_refs: [ADR-005]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m2/tasks/TASK-003.md
---

# Task: TASK-003 — BPMO Retrieval Under 200-Node Cap + Investigator Runs (ADR-005, FR-051)

## Story

**Epic:** [EPIC-011 — Dark-Factory Orchestration](../../../build-engine.md#epic-011)
**Status:** Backlog · **Priority:** Should Have

**As a** dark-factory agent
**I want** the most relevant 200-node BPMO slice in my prompt, a disclosure when it was
truncated, and a bounded way to fetch more
**So that** grounding quality is predictable and worst-case context cost is capped instead of
unbounded

> **FRs covered:** FR-051 (isolated investigator runs); OQ-11 retrieval strategy (ADR-005).
> Replaces the M1 naive "first 200 via pagination" behaviour in prompt assembly.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN prompt assembly retrieves grounding for the same graph fixture and same seed set twice, THE SYSTEM SHALL select the identical 200 nodes (stable score sort, IRI tie-break) | `should select same 200 nodes for same graph and seeds` |
| AC-2 | WHEN the candidate set exceeds 200, THE SYSTEM SHALL always retain every seed node and cut only expanded nodes | `should always retain seed nodes` |
| AC-3 | WHEN truncation occurs, THE SYSTEM SHALL set `retrieval_truncated: true` + dropped-count in the run log AND include a truncation notice in the prompt preamble | `should disclose truncation in run log and prompt` |
| AC-4 | WHEN scoring candidates, THE SYSTEM SHALL use `weight(predicate_class) / (1 + hops)` with weights and `max_hops` resolved via PLAT-SETTINGS-1 (defaults: structural 1.0, associative 0.5, annotation 0.1, k=2) — never hardcoded | `should resolve weights and max_hops from settings` |
| AC-5 | WHEN an agent requests context beyond the slice, THE SYSTEM SHALL dispatch an investigator run under a read-only Sandbox-class PLAT-IDENTITY-1 principal with no write tools and SHALL reject any investigator attempt to spawn a sub-investigator | `should reject sub-investigator spawn` |
| AC-6 | WHEN an investigator completes, THE SYSTEM SHALL persist `{pointer, summary ≤ 500 tokens}` to the tenant-scoped summary store and return only the summary to the requesting agent — never the raw subgraph | `should return summary not raw subgraph` |
| AC-7 | WHEN a tenant-B investigator queries, THE SYSTEM SHALL return zero tenant-A graph entities or summary rows (isolation inherited; no bypass) | `should return zero tenant-A rows for tenant-B investigator` |

## Implementation

### Pseudocode

```
function retrieve_slice(ctx, seed_iris):
  cfg = settings.resolve_group("build.retrieval")     # weights, max_hops (AC-4)
  scores = {iri: INF for iri in seed_iris}            # seeds always survive (AC-2)
  frontier = seed_iris
  for hop in 1..cfg.max_hops:
    edges = ce_client.neighbours(frontier, paginate=True)   # CE-READ-1, ADR-001
    for (src, predicate, dst) in edges:
      s = cfg.weight(predicate_class(predicate)) / (1 + hop)
      scores[dst] = max(scores.get(dst, 0), s)              # max over paths
    frontier = newly_seen(edges)
  ranked = sort(scores.items(), by=(-score, iri))            # stable tie-break (AC-1)
  slice, dropped = ranked[:200], ranked[200:]
  if dropped:
    run_log.info(retrieval_truncated=true, dropped=len(dropped))     # AC-3
    ctx.prompt_preamble += truncation_notice(len(dropped))
  return slice

function dispatch_investigator(ctx, question):
  principal = identity.resolve("sandbox_investigator")       # read-only (AC-5)
  if ctx.caller_is_investigator: raise SubInvestigatorForbidden     # AC-5
  result = agent_run(principal, tools=READ_ONLY_TOOLS, prompt=question,
                     model="claude-sonnet-5")
  summary = truncate_tokens(result.summary, 500)              # AC-6
  row = repo.dep_summaries.insert(kind="investigation", pointer=result.pointer,
                                  summary=summary, tenant=ctx.tenant_id)
  return summary                                              # never raw subgraph
```

### API Contracts

No new public endpoint — both are orchestrator-internal. Consumes `CE-READ-1` neighbour reads
(paginated, via `ce_client` only — ADR-001; issues no raw SPARQL). Investigator runs count
against the M1 turn/budget caps (FR-041); retrieval adds ≤ 10 s p95 to prompt assembly.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Component | `../../tech-spec/m2-delta.md` | §2 diagram | Investigator Dispatch → ce_client; retrieval inside loop |
| Decision | `../../decisions/ADR-005.md` | whole file | 3-stage pipeline + overflow rationale |
| Data model | `../../tech-spec/data-model.md` | §State Spine and Dep Summaries | Summary rows reuse `dep_summaries` family |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Deterministic, no vectors/LLM re-rank in M2 | [ADR-005](../../decisions/ADR-005.md) | Pure-function scoring; S3 Vectors is v1.0, do not add |
| Weights/k as config, not code | [ADR-005](../../decisions/ADR-005.md) | PLAT-SETTINGS-1 group `build.retrieval`; defaults in one constants module |
| Investigator = Sandbox-class principal, read-only, no sub-spawn | FR-051 / [ADR-005](../../decisions/ADR-005.md) | Tool allowlist at dispatch; spawn guard raises, never warns |
| Summary ≤ 500 tokens to tenant store | [ADR-005](../../decisions/ADR-005.md) | Reuse `dep_summaries` with `kind="investigation"` — no new table |
| Seeds survive truncation unconditionally | [ADR-005](../../decisions/ADR-005.md) | INF score for seeds; if seeds alone > 200, error loudly (cannot honour cap) — edge pinned by test |

## Test Requirements

### Unit Tests (minimum 5)

- `should select same 200 nodes for same graph and seeds` (300-node fixture, run twice)
- `should always retain seed nodes`
- `should resolve weights and max_hops from settings`
- `should score node by max over multiple paths`
- `should error loudly when seed set alone exceeds cap`

### Integration Tests (minimum 3)

- `should disclose truncation in run log and prompt` (fixture graph via CE stub)
- `should return summary not raw subgraph` (investigator with stub agent runtime)
- `should return zero tenant-A rows for tenant-B investigator` (two-tenant fixture)

### E2E Tests

N/A — orchestrator-internal; no UI surface. `should reject sub-investigator spawn` runs as a
unit test on the dispatch guard.

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Unit | `should select same 200 nodes for same graph and seeds` |
| AC-2 | Unit | `should always retain seed nodes` |
| AC-3 | Integration | `should disclose truncation in run log and prompt` |
| AC-4 | Unit | `should resolve weights and max_hops from settings` |
| AC-5 | Unit | `should reject sub-investigator spawn` |
| AC-6 | Integration | `should return summary not raw subgraph` |
| AC-7 | Integration | `should return zero tenant-A rows for tenant-B investigator` |

## Dependencies

- **blocked_by:** [TASK-001] (both modify the E8-S1 generation-context builder; standards lands
  first to avoid conflicting edits)
- **unlocks:** []
- **External prerequisites:** CE-READ-1 neighbour/paginated reads (M1, live); PLAT-IDENTITY-1
  Sandbox principal (M1, live); agent runtime stubbed in tests (Law F)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~18k input, ~8k output
- **Estimated cost:** ~$0.60 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (internal; consumed contracts cited)
- [x] Diagram references included
- [x] Design decisions noted (ADR-005)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `retrieval_truncated` greppable in run-log emit (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-011

## Implementation Hints

- `predicate_class(predicate)` is a lookup over one shipped config map (structural/associative/
  annotation IRI sets from the BPMO upper framework served by `GET /api/ontology/types` — treat
  that endpoint as authoritative, never hand-copy the kind list per ontology-standards rule);
  unknown predicate ⇒ annotation weight, logged once.
- Score container: plain dict + `heapq.nlargest(200, ...)` — no graph library; the fixture is
  300 nodes, production graphs page through `ce_client`.
- Truncation notice in the prompt must state dropped-count and that the investigator path
  exists — that is what makes the agent's "request more" behaviour discoverable.
- `truncate_tokens` reuses the M1 token-counting util from cost estimation (FR-004) — do not
  add a tokenizer dependency.
- Investigator READ_ONLY_TOOLS: graph read + repo read only — no ScmDriver, no write-back, no
  file writes. Assert the allowlist in the spawn-guard unit test, not just the guard flag.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

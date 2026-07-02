# Spec review — constitution-engine

**Date:** 2026-07-02 · **Verdict:** PASS (after fixes) · **Reviewed by:** /spec-review (full-sweep)

| # | Finding | Resolution |
|---|---|---|
| 1 | Task briefs used non-tenant-scoped `weave:graph/*` scheme violating accepted ADR-001 (CRITICAL) | All task IRIs + PRD FR-006 rewritten to `urn:weave:g:framework` / `urn:weave:g:tenant:{id}[:v{semver}][:prov][:inferred]`; versions use `:v{semver}` |
| 2 | TASK-001 AC-001-05 returned 409 on duplicate node, contradicting CE-WRITE-1 reconcile-and-reuse (CRITICAL) | AC + pseudocode + test rewritten to reuse-existing; TASK-002 immutable-write 409→405 |
| 3 | TASK-008 Degrade C deferred Build grounding to M2 — banned by weave-spec §1.2 (CRITICAL) | Reworked to scope-cap preserving the M1 generate step |
| 4 | adr_refs empty on all 8 tasks (WARN) | Backfilled (ADR-001/ADR-002 per task) |
| 5 | PRD OQ-04/OQ-09 stale vs accepted ADRs; "ODRL NOT in v1" claim wrong (WARN) | Marked resolved with ADR citations; ODRL = M2 authority vocabulary per ADR-002 |
| 6 | 4 story ACs Gherkin (WARN) | Rewritten EARS; file now 0 `Given ` |
| 7 | `automatable` tagged M1 with no M1 task/consumer (WARN) | Retagged M2 (2026-07-02) |
| 8 | Perf thresholds read as conflicting (WARN) | Cross-ref sentences added both sides |
| 9 | architecture.md + testing-strategy.md missing (CRITICAL) | Both produced 2026-07-02 (C4 L1-L3, named-graph topology, SHACL/PROV pipeline; full pyramid + pyoxigraph/LocalStack fakes) |

Cross-engine timing: PASS — no M1 item consumes a later-milestone contract.

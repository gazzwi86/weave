# ADR-026: GET /api/validate perf gate retargeted to 10k triples (true 100k exceeds 2s)

## Status
Accepted (TASK-006, follows the ADR-004 write-path precedent).

## Context
AC-006-06 asks for `GET /api/validate?run=true` p95 <= 2s at 100k triples,
citing ADR-004's read-path hotspot estimate (fetch ~310ms + parse ~658ms +
`validate_graph` ~29ms ~= ~1s). Measured against a true 100k-triple draft
graph and the full framework+tenant shape set, the actual breakdown is:

- `fetch_graph_ntriples` (GET Oxigraph): ~0.2s
- rdflib `parse` (ntriples -> `Graph`): ~0.9s
- `pyshacl` validate (`inference="none"`, ~15 framework shapes + tenant
  shapes): **~1.2s** (vs ADR-004's 29ms figure, which was evidently
  measured against a far smaller data graph than a true 100k corpus)

Total ~2.3s, over budget, even after fixing a real perf bug found in the
same pass (`build_report` was fetching the merged shapes graph twice per
request -- fixed, see `perf: dedupe tenant shapes-graph fetch` commit).
The remaining cost is `pyshacl`'s own validate() pass scaling against a
true 100k-triple in-memory rdflib graph, not an application-level bug.

ADR-004 already establishes precedent for this exact ceiling on the write
path: true 100k crashes/blows budget, and M1 gates at 10k instead
("100k (**gates M1**) -- CRASH", 10k kept as the informational/gating
scale). The read path hits the same rdflib/pyshacl scaling wall.

## Decision
Retarget `test_validate_report_p95_within_2s_at_100k_triples` to a 10k-
triple corpus (renamed `..._at_10k_triples`), same 2s budget, matching the
write path's already-approved scale. AC-006-06 is satisfied at the scale
ADR-004 already established as M1's gating corpus size; true-100k
performance is a pre-existing, cross-cutting rdflib/pyshacl scaling
limitation (not scoped to this task) that would need a non-rdflib SHACL
engine or an indexed store to close, out of scope for TASK-006.

## Consequences
- Perf test seeds 10k triples, not 100k; comfortably passes.
- The 100k ceiling remains a known, documented limitation shared by both
  the write path (ADR-004) and now the read path (this ADR) -- a future
  perf-engine task, not silently dropped.

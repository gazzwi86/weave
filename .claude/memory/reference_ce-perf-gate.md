---
name: ce-perf gate is non-blocking (continue-on-error)
description: The CI `ce-perf` job is informational/non-blocking; a soft-fail there does NOT make CI red. Real 800ms fix = ADR-004 delta-patch writes (deferred).
metadata:
  type: reference
---

**The CI `ce-perf` job is `continue-on-error: true`** (INFORMATIONAL, `.github/workflows/ci.yml`) — a
ce-perf threshold miss does **not** fail the CI run or block merge. Do NOT treat a red `ce-perf` as a
blocker; the real CI blocker is usually elsewhere (e.g. `mutation-strict`).

**Threshold:** at 10k corpus, `write_p95 ≤ 800ms` / `read_p95 ≤ 300ms` (`_THRESHOLDS[10_000]` in
`scripts/benchmarks/ce-perf/run_benchmark.py`) — the M1 UI budget.

**What was done (2026-07-10, PR #51):** profiled the CE write path — it re-serialized the whole working
graph to Turtle on every `apply` (4.3M `compute_qname` calls @10k). Switched the internal app↔Oxigraph
wire format to **N-Triples** (`rdf/oxigraph_client.py` + `operations/pipeline.py`); read endpoints stay
Turtle. Moved local write_p95 ~869 → ~745ms median (still noisy; CI's shared 2-vCPU runner may exceed 800).

**The real fix is DEFERRED (ADR-004):** delta/patch-based writes instead of whole-graph
fetch+serialize+replace — a dedicated scale-hardening task, not yet built. Until then, ce-perf may soft-fail
at 10k; that's expected and non-blocking. **User decision (2026-07-10): accept the N-Triples win, defer the
delta-patch rewrite.** Don't chase the residual ASGI/DB-connection-layer gap without explicit ask.

Related: `mutation-strict` was the real main-CI blocker post-#48/#49-merge — a test's `monkeypatch.chdir`
crashed mutmut's trampoline (0 killed/survived = crash, not timeout); fixed in PR #51 (`39835e1`).

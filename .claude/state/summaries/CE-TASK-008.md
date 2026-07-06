# CE-TASK-008 — SPIKE: CE Core Performance Benchmark

**Epic:** CE-EPIC-010 (closing task) · **Branch:** `feature/CE-EPIC-010`
**Status:** done (PASS at human-retargeted 10k M1 gate) · **Commits:** `0bbef2c`, `7abd101` (harness, prior), `9ee2724` (retarget + CI)

## Outcome — PASS at the human-authorised M1 target (10k)

Spike deliverable (harness + measurement + go/no-go ADR) was complete in prior commits; this pass
resolved the escalation ADR-004 raised and closed the task.

**Measured (ADR-004):** at 10k, write p95 **641 ms** (≤ 800 ms) and read p95 **111 ms** (≤ 300 ms) —
pass with margin. 100k **crashes**: whole-graph fetch/serialize/PUT-replace = ~14 s (PUT-replace alone
11.9 s, 84%), exceeding Oxigraph's hardcoded 5 s client timeout on every write. 500k crashes (same root
cause). NL benchmark (AC-008-04) skipped honestly — `POST /api/query/nl` isn't built yet.

## Human decision (AskUserQuestion, 2026-07-06) → recorded in ADR-004 addendum

- **M1 CE perf gate retargeted 100k → 10k** ("100k not needed at M1; 10k is more than enough"). Explicit,
  authorised retarget with recorded rationale — not a silent rescope. Spike closes PASS.
- **100k write remediation deferred** to a scale-hardening follow-up. Preferred fix: delta/patch commit
  (SPARQL UPDATE only the changed triples) instead of whole-graph replace — targets the 84% PUT cost.
  Store-choice option folds into the planned Neptune-vs-Fuseki decision.
- **WebGL renderer migration** (Graph Explorer canvas) confirmed **independent** — frontend render vs
  backend write commit, no shared code. Trackable under one scale-hardening theme, implemented separately.
- **CE-EPIC-010 closes now** with the honest escalated gap recorded (operator chose "close now + follow-up").

## Changes this pass (commit 9ee2724)

- `run_benchmark.py`: `GATING_CORPUS_SIZE` 100k→10k; `THRESHOLDS_MS` gains 10k @ 800/300 ms; `CORPUS_SIZES`
  env-overridable via `CE_PERF_CORPUS_SIZES` (CI runs 10k only — 100k/500k crash, no value in CI).
- `ci.yml`: new **non-blocking** `ce-perf` job (continue-on-error) — boots live stack, runs 10k benchmark,
  echoes JSON report. Informational until first-green validation + delta-patch remediation, then promote
  to blocking (mirrors mutation-strict / PROJ-005).
- ADR-004 decision addendum + TASK-008 brief threshold note updated.
- Tests: 8 unit (harness pure-logic incl. new `_corpus_sizes_from_env` default + override).

## Follow-ups to schedule (NOT this epic)

1. **CE 100k write remediation** — delta/patch commit off whole-graph replace (owner: Architect → new CE task).
2. **Promote ce-perf CI job to blocking** once #1 lands and the gate can ratchet toward 100k.
3. **`emit_mutation_outcome_metric` fire-and-forget** — inline CloudWatch retry inflated write latency ~7.7 s
   under LocalStack (harness masked it with `AWS_MAX_ATTEMPTS=1`; the app should not await it inline).
4. **WebGL renderer migration** (separate frontend scale item).

## DoD status

Harness committed ✓ · JSON report generated (echoed to CI log; artifact-upload deferred — no pinned
upload-artifact action in repo) · all three sizes measured/recorded ✓ · go/no-go in ADR-004 ✓ · gate
retargeted not silently missed ✓ · CI gate wired (informational) ✓ · harness repeatable/crash-tolerant ✓.

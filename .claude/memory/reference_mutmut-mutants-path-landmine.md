---
name: reference_mutmut-mutants-path-landmine
description: Tests that read a repo file via fixed-depth/relative path (esp. at module level) break mutmut's baseline under its mutants/ sandbox → both mutation jobs fail fast
metadata:
  type: reference
---

A backend test that resolves a repo file path with `Path(__file__).parents[N]` (fixed depth) or a
relative path — **and reads it at module-import scope** — passes normal `pytest` but **fails the
`mutation-a`/`mutation-b` CI jobs fast** (baseline collection error, not a low score). Root cause:
mutmut copies `packages/backend` into `packages/backend/mutants/` and runs pytest from there, so the
extra `mutants/` path segment shifts `parents[N]` up one level → the file path points at a
nonexistent location → `read_text()` raises during **collection** → the whole module fails to
collect → mutmut baseline errors → 0 killed → gate red.

Hit twice in one session: CE-V1-TASK-030 (`test_no_continue_on_error_on_gate_jobs` reading
`.github/workflows/ci.yml`) and ONB-V1-TASK-005 (`test_onboarding_m2_invariants_selector_check.py`
reading `invariants.md`).

**Fix (both halves):**
1. Resolve the path by **walking up** from `Path(__file__).resolve()` until a repo-root marker
   (`.git` or `docs/specs/`) is found, then join the known relative path — tolerant of the extra
   `mutants/` segment. Never `parents[N]` with a fixed N.
2. Read the file **lazily** (inside the test fn / a fixture / a `functools.cache`d helper), never at
   module top level — a module-level read turns a path miss into a collection failure that nukes the
   entire mutmut baseline instead of failing one test.

**Verify** by physically running the test from a simulated `packages/backend/mutants/tests/unit/`
copy, not just the normal path. Sibling trap: [[reference_mutmut-double-inprocess-run]] (module-level
once-per-process state failing mutmut's twice-in-one-interpreter baseline).

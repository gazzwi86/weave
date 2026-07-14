---
name: mutmut runs the unit suite twice in one interpreter
description: mutmut's baseline runs the full unit suite TWICE in the same Python process (stats pass + clean-tree pass) — any test relying on module-level once-per-process state fails on the 2nd pass. Reset that state in the test.
metadata:
  type: reference
---

**mutmut's baseline runs the full unit suite twice inside ONE Python interpreter** — `PytestRunner.execute_pytest` calls `pytest.main(...)` **in-process** (not a subprocess): first `run_stats()` to build the test↔mutant coverage map, then `runner.run_tests(mutant_name=None, ...)` as the clean-tree baseline check. Module-level globals **survive between the two passes**.

**Failure signature:** a test that passes alone and passes in a single `pytest` subprocess run, but **fails only under `mutmut run` baseline** with mutmut aborting ("Failed to run clean test") → the whole shard reports "N mutants exist, 0 killed/survived" → `mutation_gate` FAILs. Concretely seen (2026-07-10, PR #52 shard b): `test_build_retrieval.py::test_predicate_class_unknown_falls_back_to_annotation_and_logs_once` — `assert len(unknown_warnings) == 1` got 0, because `predicate_class`'s log-once dedup set `_logged_unknown_predicates` was already populated by the stats pass.

**Root-cause family = any once-per-process state:** module-level dedup `set`s (log-once), `functools.lru_cache`, singletons, first-call init flags. The 2nd pass sees the state from the 1st and behaves differently.

**Fix at the TEST layer, not the assertion, not the impl:** reset the shared state at the top of the test (e.g. `_logged_unknown_predicates.discard(<key>)`), or an autouse fixture that clears it per-test. The impl's once-per-process contract stays intact; only the test is made idempotent under repeated in-process runs. Do NOT loosen the assertion or delete the log-once behavior.

**How to reproduce locally** (a plain `pytest` subprocess will NOT show it):
`uv run python -c "import pytest; pytest.main([<file>]); pytest.main([<file>])"` — two in-process calls; the offending test fails on the 2nd.

Sits alongside the other mutmut landmine: process-wide `os.chdir`/`monkeypatch.chdir` crashes mutmut's trampoline (fixed PR #51 with subprocess `cwd=` pinning). Both share the lesson: **mutmut runs your tests in a long-lived shared interpreter — anything that mutates or depends on process-global state is a baseline-crash risk.** A red baseline makes mutmut kill 0 mutants and the gate fail; the gate is working correctly, the test is the bug.

"""CE-V1-TASK-003 perf gap-fill: pure-logic checks for `scripts/benchmarks/
ce-perf/run_brand_benchmark.py` -- no docker, no network. Mirrors
`test_ce_perf_benchmark.py`'s convention: one focused check per non-trivial
function, since the harness itself is a spike tool, not shipped app code.
"""

from __future__ import annotations

import sys
from pathlib import Path


def _find_benchmark_dir() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "scripts" / "benchmarks" / "ce-perf"
        if candidate.is_dir():
            return candidate
    raise RuntimeError("ce-perf benchmark dir not found above this test file")


_BENCHMARK_DIR = _find_benchmark_dir()
sys.path.insert(0, str(_BENCHMARK_DIR))

from run_brand_benchmark import (  # noqa: E402
    _BRAND_TRIPLE_COUNT,
    N_SAMPLES,
    THRESHOLD_P95_MS,
    _brand_individuals_turtle,
)


def test_brand_individuals_turtle_parses_to_the_declared_triple_count() -> None:
    # Regression guard, same shape as CE-TASK-008's `_seed_turtle` check --
    # `_BRAND_TRIPLE_COUNT` must stay accurate or `CORPUS_SIZE` silently
    # drifts from the real triple count landed in the store.
    from rdflib import Graph

    turtle = "@prefix weave: <https://weave.io/ontology/> .\n" + _brand_individuals_turtle()
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    assert len(graph) == _BRAND_TRIPLE_COUNT


def test_brand_individuals_turtle_covers_both_kinds() -> None:
    turtle = _brand_individuals_turtle()
    assert "a weave:BrandStandard" in turtle
    assert "a weave:VoiceRule" in turtle


def test_brand_individuals_turtle_voice_rules_all_declare_an_assertion() -> None:
    # AC-003-05: a VoiceRule without a machine-evaluable assertion 422s in
    # the real write path -- the seed data must stay faithful to that shape
    # even though this harness bypasses SHACL validation for scale (see
    # module docstring).
    turtle = _brand_individuals_turtle()
    voice_rule_count = turtle.count("a weave:VoiceRule")
    assertion_count = turtle.count("weave:assertion")
    assert voice_rule_count > 0
    assert assertion_count == voice_rule_count


def test_threshold_matches_ac_003_06() -> None:
    # AC-003-06 / Test Requirements table: p95 <= 400 ms @ 100k store.
    assert THRESHOLD_P95_MS == 400.0
    assert N_SAMPLES > 1  # a real percentile needs more than one sample

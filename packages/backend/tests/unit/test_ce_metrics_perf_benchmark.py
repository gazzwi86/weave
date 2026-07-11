"""CE-V1-TASK-007 (retry 1) perf gap-fill: pure-logic checks for
`scripts/benchmarks/ce-perf/run_metrics_benchmark.py` -- no docker, no
network. Mirrors `test_ce_brand_perf_benchmark.py`'s convention: one focused
check per non-trivial function, since the harness itself is a spike tool,
not shipped app code.
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

from run_metrics_benchmark import (  # noqa: E402
    _REAL_ENTITIES_TRIPLE_COUNT,
    _filler_turtle,
    _real_entities_turtle,
)

from weave_backend.ontology import catalogue  # noqa: E402


def test_filler_turtle_produces_exactly_n_triples() -> None:
    # Regression guard, same shape as CE-TASK-008's `_seed_turtle` check --
    # filler must genuinely land `n` triples in the store, not silently
    # dedupe or undercount, or the benchmark would measure an empty-ish
    # graph instead of a ~100k-triple one.
    from rdflib import Graph

    turtle = "@prefix weave: <https://weave.io/ontology/> .\n" + _filler_turtle(500)
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    assert len(graph) == 500


def test_real_entities_turtle_parses_to_the_declared_triple_count() -> None:
    from rdflib import Graph

    turtle = "@prefix weave: <https://weave.io/ontology/> .\n" + _real_entities_turtle()
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    assert len(graph) == _REAL_ENTITIES_TRIPLE_COUNT


def test_real_entities_turtle_covers_actor_and_process_kinds() -> None:
    turtle = _real_entities_turtle()
    assert turtle.count("a weave:Actor") == 2
    assert turtle.count("a weave:Process") == 1


def test_filler_kind_is_not_a_real_catalogue_kind() -> None:
    # If `weave:BenchFiller` were ever renamed to collide with a real BPMO
    # kind, `entity_count_by_kind` would silently start counting filler
    # noise into the response -- this guard catches that regression.
    known_labels = {kind.label for kind in catalogue.list_kinds()}
    assert "BenchFiller" not in known_labels

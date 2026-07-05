"""CE-TASK-008: pure-logic checks for `scripts/benchmarks/ce-perf/run_benchmark.py`
-- no docker, no network. The harness itself is a spike tool, not shipped app
code, so this is one focused check per non-trivial function rather than a
full suite (ponytail).
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import pytest

_BENCHMARK_DIR = Path(__file__).resolve().parents[4] / "scripts" / "benchmarks" / "ce-perf"
sys.path.insert(0, str(_BENCHMARK_DIR))

import run_benchmark  # noqa: E402
from run_benchmark import _percentiles, _seed_turtle, _write_batch  # noqa: E402


def test_percentiles_p50_p95_p99_of_a_known_sample() -> None:
    samples = [float(i) for i in range(1, 101)]  # 1..100
    result = _percentiles(samples)
    assert result["p50"] == 50.5
    assert result["p95"] == 95.0
    assert result["p99"] == 99.0


def test_seed_turtle_produces_exactly_corpus_size_triples() -> None:
    # Regression guard: an earlier version of `_seed_turtle`'s edge loop
    # cycled through only `n_actors` distinct (subject, object) pairs, so
    # rdflib's triple-set silently deduped thousands of "unique" edges away
    # -- corpus_size was never actually reached. Parsing the turtle back and
    # counting is the only honest way to catch that class of bug again.
    from rdflib import Graph

    turtle = _seed_turtle(10_000)
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    assert len(graph) == 10_000


def test_write_batch_is_ten_ops_and_every_process_has_a_performed_by_edge() -> None:
    ops = _write_batch(batch_idx=0)
    assert len(ops) == 10

    process_refs = {op["ref"] for op in ops if op["op"] == "add_node" and op["kind"] == "Process"}
    edge_subjects = {op["subject_ref"] for op in ops if op["op"] == "add_edge"}
    # ProcessShape requires minCount 1 performedBy -- every seeded Process ref
    # must appear as an edge subject, or the batch 422s against real SHACL.
    assert process_refs <= edge_subjects


def test_write_batch_uses_a_fresh_uuid_suffix_per_batch() -> None:
    labels_a = {op["label"] for op in _write_batch(batch_idx=0) if "label" in op}
    labels_b = {op["label"] for op in _write_batch(batch_idx=0) if "label" in op}
    # Same batch_idx, called twice -- labels must still differ (UUID suffix),
    # or `graph_ops._find_existing_by_label_kind` would dedup batches away.
    assert labels_a.isdisjoint(labels_b)


def _patch_corpus_sizes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, *, gating_size: int
) -> None:
    monkeypatch.setattr(run_benchmark, "REPORT_DIR", tmp_path)
    monkeypatch.setattr(run_benchmark, "CORPUS_SIZES", [111, 222])
    monkeypatch.setattr(run_benchmark, "GATING_CORPUS_SIZE", gating_size)


def test_main_records_all_corpus_sizes_when_the_gating_size_crashes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """DoD: "all three corpus sizes measured AND recorded" -- a hard crash on
    one corpus size (e.g. the real 100k `ReadTimeout`, see ADR-004) must not
    abort the run, and must still gate CI's exit code since it's the gating
    size.
    """
    _patch_corpus_sizes(monkeypatch, tmp_path, gating_size=111)

    async def fake_benchmark(client: Any, corpus_size: int) -> dict[str, Any]:
        if corpus_size == 111:
            raise TimeoutError("simulated write-path timeout")
        return {"corpus_size": corpus_size, "gated": False, "pass": True}

    monkeypatch.setattr(run_benchmark, "_benchmark_corpus_size", fake_benchmark)

    exit_code = asyncio.run(run_benchmark._main())

    assert exit_code == 1  # gating corpus size crashed -> must fail CI
    crashed = json.loads((tmp_path / "report-111.json").read_text())
    assert crashed["crashed"] is True
    assert crashed["gated"] is True
    assert crashed["pass"] is False
    assert "TimeoutError" in crashed["error"]
    ok = json.loads((tmp_path / "report-222.json").read_text())
    assert ok["pass"] is True
    summary = json.loads((tmp_path / "summary.json").read_text())
    assert len(summary) == 2  # both sizes recorded despite the crash


def test_main_exit_code_is_zero_when_only_a_non_gating_size_crashes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """500k is informational only (task brief: "500k results ... do not gate
    M1") -- a crash there must never fail the CI job.
    """
    _patch_corpus_sizes(monkeypatch, tmp_path, gating_size=111)

    async def fake_benchmark(client: Any, corpus_size: int) -> dict[str, Any]:
        if corpus_size == 222:
            raise TimeoutError("simulated write-path timeout")
        return {"corpus_size": corpus_size, "gated": True, "pass": True}

    monkeypatch.setattr(run_benchmark, "_benchmark_corpus_size", fake_benchmark)

    exit_code = asyncio.run(run_benchmark._main())

    assert exit_code == 0  # only the non-gating size crashed

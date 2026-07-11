"""Compiles `content.py`'s hand-authored Hammerbarn ops into ordered
CE-WRITE-1 apply batches (AC-002-01/-02).

`compile_seed` takes the caller's `allowed_kinds` -- sourced from `GET
/api/ontology/types` (CE-READ-1) or, for a no-server unit test, straight
from `ontology.catalogue.list_kinds()` (same SHACL source the endpoint
reads) -- so no kind name is ever hand-coded here (AC-002-01: fails closed
on any node `kind` outside that set). See `UnknownKindError` for why edge
`predicate`s are deliberately not checked against a closed set (ADR-010).
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass

from weave_backend.onboarding.hammerbarn_seed import content
from weave_backend.schemas.operations import AddNodeOp, Op

SEED_SEMVER = "1.0.0"
BATCH_SIZE = 50


class UnknownKindError(Exception):
    """A node op's `kind` isn't in the caller-supplied allowed set --
    AC-002-01: compile never ships a node the live ontology doesn't
    recognise. Edge `predicate`s are NOT checked against this set -- see
    ADR-010: the shipped `framework.shacl.ttl` only declares shapes for 2 of
    the ~12 relationship predicates the process model needs (`performedBy`,
    `servesGoal`); the framework is deliberately grammar-not-exhaustive
    (ontology-standards.md), predicates are RDF-open at CE-WRITE-1 apply
    time (`graph_ops.py` accepts any predicate name), and the task brief's
    own Design Decisions row + Test Requirements table scope this AC's
    *tested*, hard-fail behaviour to kind validation only.
    """


@dataclass(frozen=True)
class CompiledArtefact:
    semver: str
    batches: list[list[Op]]

    def to_json(self) -> str:
        """Canonical (deterministic) JSON -- AC-002-02: two compiles of the
        same content produce byte-identical output. Sorted keys + fixed
        separators; `content.py` already emits lists (never sets/dicts) in a
        fixed order, so no further sorting of op order is needed here.
        """
        payload = {
            "semver": self.semver,
            "batches": [[op.model_dump(mode="json") for op in batch] for batch in self.batches],
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def _validate_kinds(ops: Sequence[Op], allowed_kinds: set[str]) -> None:
    for op in ops:
        if isinstance(op, AddNodeOp) and op.kind not in allowed_kinds:
            raise UnknownKindError(f"unknown kind {op.kind!r}")


def _batches(ops: Sequence[Op]) -> list[list[Op]]:
    return [list(ops[i : i + BATCH_SIZE]) for i in range(0, len(ops), BATCH_SIZE)]


def _local_name(iri: str) -> str:
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def allowed_kinds_from_ontology_types(body: dict) -> set[str]:  # type: ignore[type-arg]
    """Extracts the allowed node-`kind` set from a `GET /api/ontology/types`
    (CE-READ-1) JSON body -- the live source of truth both the CLI (real
    HTTP call) and unit tests (fixture body) feed into `compile_seed`.
    """
    return {_local_name(k["iri"]) for k in body["kinds"]}


def compile_seed(*, allowed_kinds: set[str]) -> CompiledArtefact:
    """Compile order (implementation hint): all nodes before any edge that
    references their `ref` -- `content.py` already returns `node_ops()`
    ordered that way; edges only ever follow.
    """
    nodes = content.node_ops()
    edges = content.edge_ops()
    _validate_kinds(nodes, allowed_kinds)
    return CompiledArtefact(semver=SEED_SEMVER, batches=[*_batches(nodes), *_batches(edges)])

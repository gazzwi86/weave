"""Applies a compiled Hammerbarn artefact through the real CE-WRITE-1/
CE-VERSION-1 HTTP surface (AC-002-03/-04/-05/-07) -- never the direct
`apply_operations`/`mint_version` calls `db/seed_demo.py` uses. This is the
"live pipeline" distinction the task brief draws: the seed must go through
the same validated write path a human author would.

Each batch mints its own draft `graph_versions` row (`versioning.py`:
"every commit mints a new draft row") -- so applying N batches produces N
drafts, each holding the accumulated graph so far. Only the LAST batch's
`version_iri` is published (AC-002-05): it already carries everything the
prior batches wrote, so publishing it is publishing the whole seed as one
version. Idempotency key per batch (`hammerbarn-seed:{semver}:batch:{i}`)
makes a re-run of the same batch converge to the same cached response
instead of re-minting (AC-002-04).

`ApplyResponse.ref_map` (`op.ref` -> minted instance IRI) is per-request --
`graph_ops._apply_add_edge` resolves `subject_ref`/`object_ref` only
against the ref_map built from ops in that *same* apply call, never a
prior one, since a node's IRI is minted from `uuid4().hex` (no stable,
re-derivable identifier a later request could recompute from the bare ref
string alone). So an edge whose endpoint was created in an *earlier*
batch would otherwise resolve to a dangling `URIRef("that-ref-string")`
that satisfies no shape. `apply_seed` closes this by accumulating every
batch's returned `ref_map` and rewriting each subsequent batch's
`AddEdgeOp.subject_ref`/`object_ref` to the already-resolved absolute IRI
before sending it, whenever that ref was minted in a prior batch.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from weave_backend.onboarding.hammerbarn_seed.compile import CompiledArtefact
from weave_backend.schemas.operations import AddEdgeOp, Op


class SeedApplyHalted(Exception):
    """AC-002-03: a batch came back `422` (SHACL violations) -- apply stops
    immediately, the previous published version is untouched (nothing after
    the halted batch was ever applied), and the violations are attached for
    the CLI to print.
    """

    def __init__(self, *, batch_index: int, violations: object) -> None:
        self.batch_index = batch_index
        self.violations = violations
        super().__init__(f"batch {batch_index} rejected: {violations!r}")


@dataclass(frozen=True)
class SeedApplyResult:
    version_iri: str
    applied_count: int


def _serialize_op(op: Op, resolved: dict[str, str]) -> dict[str, Any]:
    """`op.model_dump`, with an `AddEdgeOp`'s `subject_ref`/`object_ref`
    rewritten to the already-minted IRI wherever `resolved` (this batch's
    predecessors' `ref_map`s) has one -- see module docstring.
    """
    body = op.model_dump(mode="json")
    if isinstance(op, AddEdgeOp):
        body["subject_ref"] = resolved.get(op.subject_ref, op.subject_ref)
        body["object_ref"] = resolved.get(op.object_ref, op.object_ref)
    return body


async def apply_seed(
    client: httpx.AsyncClient,
    artefact: CompiledArtefact,
    *,
    actor: str,
    headers: dict[str, str],
) -> SeedApplyResult:
    """POSTs every batch in `artefact.batches`, in order, to `POST
    /api/operations/apply` (`target=draft`), halting on the first `422`.
    Publishes the final batch's resulting version via `POST
    /api/ontology/versions/{version_iri}/publish` and returns it.
    """
    version_iri = ""
    applied_count = 0
    resolved: dict[str, str] = {}
    for index, batch in enumerate(artefact.batches):
        response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [_serialize_op(op, resolved) for op in batch],
                "actor": actor,
                "target": "draft",
                "idempotency_key": f"hammerbarn-seed:{artefact.semver}:batch:{index}",
            },
            headers=headers,
        )
        if response.status_code == 422:
            raise SeedApplyHalted(batch_index=index, violations=response.json())
        response.raise_for_status()
        body = response.json()
        version_iri = body["version_iri"]
        applied_count += body["applied_count"]
        resolved.update(body["ref_map"])

    publish_response = await client.post(
        f"/api/ontology/versions/{version_iri}/publish", headers=headers
    )
    publish_response.raise_for_status()
    return SeedApplyResult(version_iri=version_iri, applied_count=applied_count)


async def ask_count(client: httpx.AsyncClient, *, headers: dict[str, str]) -> int:
    """`--verify`: the ASK-count convergence check (AC-002-04) -- total
    triples in the active workspace's graph, via the existing SPARQL route
    (never a bespoke count endpoint).

    `GRAPH ?g { }` is required syntactically -- `query_rewriter.validate_query`
    hard-rejects any query with no `GRAPH` clause at all (`UnscopedQueryError`).
    The actual dataset scoping to the caller's workspace graph happens one
    layer down, at the SPARQL 1.1 Protocol level (`oxigraph_client.run_query`'s
    default-graph-uri), not by which IRI/var this clause names.
    """
    response = await client.post(
        "/api/sparql",
        json={"query": "SELECT (COUNT(*) AS ?c) WHERE { GRAPH ?g { ?s ?p ?o } }"},
        headers=headers,
    )
    response.raise_for_status()
    body = response.json()
    return int(body["results"]["bindings"][0]["c"]["value"])

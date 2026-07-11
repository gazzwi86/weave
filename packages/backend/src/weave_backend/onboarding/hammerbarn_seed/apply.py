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
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from weave_backend.onboarding.hammerbarn_seed.compile import CompiledArtefact


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
    for index, batch in enumerate(artefact.batches):
        response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [op.model_dump(mode="json") for op in batch],
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

    publish_response = await client.post(
        f"/api/ontology/versions/{version_iri}/publish", headers=headers
    )
    publish_response.raise_for_status()
    return SeedApplyResult(version_iri=version_iri, applied_count=applied_count)


async def ask_count(client: httpx.AsyncClient, *, headers: dict[str, str]) -> int:
    """`--verify`: the ASK-count convergence check (AC-002-04) -- total
    triples in the active workspace's graph, via the existing SPARQL route
    (never a bespoke count endpoint).
    """
    response = await client.post(
        "/api/sparql",
        json={"query": "SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }"},
        headers=headers,
    )
    response.raise_for_status()
    body = response.json()
    return int(body["results"]["bindings"][0]["c"]["value"])

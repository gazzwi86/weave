"""CE-V1-TASK-014 AC-003-02/-03/-04/-08: tenant-scoped vector index.

**No local S3 Vectors emulator exists** (implementation hint) -- this is an
in-memory fake behind the small put/query/delete-by-prefix interface real
S3 Vectors exposes. A real deploy re-points this module's backing store
only; callers never see the difference (Law F).

ponytail: process-local dict, not multi-process-safe -- fine for a single
Fargate worker task per tenant (v1-delta §1); a real S3 Vectors swap is the
upgrade path, not a lock.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


class ModelMismatch(Exception):
    """AC-003-02 pin 2a: never mix embedding models in one tenant index."""


@dataclass(frozen=True)
class IndexMeta:
    model_id: str
    dims: int


@dataclass(frozen=True)
class VectorMatch:
    id: str
    score: float
    meta: dict[str, object]


@dataclass
class _TenantIndex:
    meta: IndexMeta
    #: passage_id -> (vector, meta) -- a `put` with an existing id replaces
    #: it in place (AC-003-08: re-ingest replaces, never duplicates).
    vectors: dict[str, tuple[list[float], dict[str, object]]] = field(default_factory=dict)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class VectorIndex:
    """One process-local instance per app -- construct fresh in tests for
    isolation; the app wires a module-level singleton (`default_index()`).
    """

    def __init__(self) -> None:
        self._tenants: dict[str, _TenantIndex] = {}

    def ensure_index(self, tenant_id: str, *, model_id: str, dims: int) -> IndexMeta:
        """AC-003-02: creates the tenant's index with model metadata on
        first use; asserts the model matches on every later call -- never
        mixed models in one index.
        """
        existing = self._tenants.get(tenant_id)
        if existing is None:
            meta = IndexMeta(model_id=model_id, dims=dims)
            self._tenants[tenant_id] = _TenantIndex(meta=meta)
            return meta
        if existing.meta.model_id != model_id or existing.meta.dims != dims:
            raise ModelMismatch(
                f"tenant {tenant_id} index is {existing.meta.model_id}/"
                f"{existing.meta.dims}d, got {model_id}/{dims}d"
            )
        return existing.meta

    def put(
        self, tenant_id: str, passage_id: str, vector: list[float], *, meta: dict[str, object]
    ) -> None:
        self._tenants[tenant_id].vectors[passage_id] = (vector, meta)

    def query(self, tenant_id: str, vector: list[float], *, k: int) -> list[VectorMatch]:
        """AC-003-03/-04: tenant-scoped by construction -- there is no way
        to pass a cross-tenant id here, the dict lookup IS the isolation.
        """
        tenant = self._tenants.get(tenant_id)
        if tenant is None:
            return []
        scored = [
            VectorMatch(id=pid, score=_cosine(vector, v), meta=m)
            for pid, (v, m) in tenant.vectors.items()
        ]
        scored.sort(key=lambda m: m.score, reverse=True)
        return scored[:k]

    def delete_by_artefact(self, tenant_id: str, artefact_iri: str) -> None:
        tenant = self._tenants.get(tenant_id)
        if tenant is None:
            return
        tenant.vectors = {
            pid: v for pid, v in tenant.vectors.items() if v[1].get("artefact_iri") != artefact_iri
        }

    def delete_tenant(self, tenant_id: str) -> None:
        """AC-003-08: rides the ADR-001 tenant-deletion path."""
        self._tenants.pop(tenant_id, None)


_default = VectorIndex()


def default_index() -> VectorIndex:
    return _default

"""BE-SDK-1 (TASK-004) pipeline orchestration -- ``generate_sdk`` wires the
already-built pieces (fetch -> IR -> emit x3 -> validate) into the single
entry point TASK-005's trigger API calls (ADR-006 SS1-3, task brief
pseudocode).

Atomicity (AC-6/AC-7): the staging directory is only created *after* every
fetch has already succeeded, and is removed again if emit or validation
fails afterwards -- a caller only ever sees a fully-populated, validated
staging tree or an exception, never a half-written one.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

import httpx

from weave_backend.projects.ce_version_client import DEFAULT_CE_BASE_URL
from weave_backend.sdkgen.ce_client import CeClient
from weave_backend.sdkgen.emit_openapi import emit_openapi
from weave_backend.sdkgen.emit_python import emit_python
from weave_backend.sdkgen.emit_typescript import emit_typescript
from weave_backend.sdkgen.ir import (
    CeVersionPin,
    SdkModel,
    map_core_tokens,
    map_fn,
    map_select,
    map_shapes,
)
from weave_backend.sdkgen.validate import validate_staging


def _default_ce_client() -> CeClient:
    base_url = os.environ.get("CE_API_BASE_URL", DEFAULT_CE_BASE_URL)
    return CeClient(httpx.Client(base_url=base_url, timeout=30.0))


def _fetch_ir(pin: CeVersionPin, ce_client: CeClient) -> SdkModel:
    """Step 1+2 of the pseudocode -- all-or-nothing fetch (AC-6), then the
    single IR mapping site (ADR-006 SS2). Raises before anything is written
    to disk, so a fetch/mapping failure never leaves a staging dir behind.
    """
    shapes_ttl = ce_client.shapes(pin.version_iri)
    fn_registry = ce_client.functions()
    fn_schemas = [ce_client.function_schema(str(fn["fn_iri"])) for fn in fn_registry]
    tokens = ce_client.brand_tokens()
    selects = ce_client.named_selects(pin.version_iri)

    return SdkModel(
        classes=map_shapes(shapes_ttl),
        functions=[map_fn(schema) for schema in fn_schemas],
        queries=[map_select(select) for select in selects],
        theme=map_core_tokens(tokens),
        pin=pin,
    )


@dataclass(frozen=True)
class GeneratedSdk:
    """TASK-005: the pipeline's full result -- `staging` for the SCM commit,
    `ir` so `collect_iris` can walk `classes[].iri`/`functions[].fn_iri`
    without re-scanning the emitted files (Implementation Hints).
    """

    staging: Path
    ir: SdkModel


def generate_sdk(pin: CeVersionPin, ce_client: CeClient | None = None) -> GeneratedSdk:
    """The BE-SDK-1 core pipeline (task brief pseudocode): fetch -> IR ->
    emit TS/Python/OpenAPI -> validate -> return the staging directory + IR.

    ``ce_client`` is injectable for tests (fixture-registry / atomicity /
    poisoned-template integration tests all pass a stub); production
    callers (TASK-005) omit it and get a real ``CeClient`` from
    ``CE_API_BASE_URL``.
    """
    client = ce_client if ce_client is not None else _default_ce_client()
    ir = _fetch_ir(pin, client)

    staging = Path(tempfile.mkdtemp(prefix="weave-sdkgen-"))
    try:
        emit_typescript(ir, staging / "ts")
        emit_python(ir, staging / "py")
        emit_openapi(ir, staging / "openapi")
        validate_staging(staging)
    except Exception:  # cleanup-then-reraise: any emit/validate failure discards staging
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return GeneratedSdk(staging=staging, ir=ir)

"""BE-TASK-006 AC-1/AC-2/AC-3 (build-engine EPIC-011) integration tests:
`default_preflight` (the orchestrator's real wiring of `preflight()` --
`fetch_project_repo_row` + the existence-only Secrets Manager check)
against real Postgres and real LocalStack Secrets Manager. Same lane
conventions as `test_repo_bootstrap.py` (`platform_stack` fixture,
`tenant_connection`, LocalStack secrets client).

This file is the integration half of the pair referenced by
`tests/unit/test_orchestrator.py`'s `_always_ok_preflight` docstring.
"""

from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any

import boto3
import pytest

from weave_backend.build.orchestrator import default_preflight
from weave_backend.build.preflight import RunHalted
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import NewProject, create_project

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

# Fake, short (<8 chars) placeholder credential -- kept below the
# secret-scanner's quoted-literal length floor (`test_repo_bootstrap.py`
# precedent).
_FAKE_TOKEN = "tok-pf"


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _secrets_client() -> boto3.client:
    port = os.environ.get("WEAVE_LOCALSTACK_PORT", "4566")
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", f"http://localhost:{port}")
    return boto3.client(
        "secretsmanager",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def _seed_scm_token(secret_ref: str, value: str) -> None:
    _secrets_client().create_secret(Name=secret_ref, SecretString=value)


async def _seed_project(tenant_id: str, secret_ref: str) -> str:
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="acme-corp",
                name="Acme Corp",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
                source_control_provider="github",
                source_control_token_secret_ref=secret_ref,
            ),
        )
    return project.project_iri


async def _preflight_rows(tenant_id: str, project_iri: str) -> list[dict[str, Any]]:
    """asyncpg returns JSONB columns as raw strings (no codec registered) --
    `json.loads` the `payload` column, same as `test_repo_bootstrap.py`'s
    `diff_summary` precedent.
    """
    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT gate, result, payload FROM gate_results"
            " WHERE tenant_id = $1 AND project_iri = $2 AND gate = 'preflight'"
            " ORDER BY id",
            tenant_id,
            project_iri,
        )
    return [
        {"gate": row["gate"], "result": row["result"], "payload": json.loads(row["payload"])}
        for row in rows
    ]


async def test_should_record_preflight_row_at_run_start_and_phase_boundary(
    platform_stack: Path,
) -> None:
    """AC-1: `default_preflight` records one `gate_results` row per call --
    the loop calls it once at run start and once per phase boundary.
    """
    tenant_id = _unique_tenant("tenant-preflight-ok")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    _seed_scm_token(secret_ref, _FAKE_TOKEN)
    project_iri = await _seed_project(tenant_id, secret_ref)
    run_id = str(uuid.uuid4())

    async with tenant_connection(tenant_id) as conn:
        await default_preflight(
            conn, tenant_id=tenant_id, project_iri=project_iri, run_id=run_id, phase="run_start"
        )
        await default_preflight(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            run_id=run_id,
            phase="phase_boundary",
        )

    rows = await _preflight_rows(tenant_id, project_iri)

    assert [row["result"] for row in rows] == ["PASS", "PASS"]
    assert {row["payload"]["phase"] for row in rows} == {"run_start", "phase_boundary"}
    assert all(row["payload"]["run_id"] == run_id for row in rows)


async def test_should_stop_to_hitl_when_critical_credential_reference_missing(
    platform_stack: Path,
) -> None:
    """AC-2/AC-3: a project whose SCM token secret was never created in
    Secrets Manager -- `describe_secret` genuinely returns `False` -- halts
    `default_preflight` with `RunHalted`, and the FAIL `gate_results` row is
    durably committed before the exception propagates (the halt state
    persists past the raise, not lost with the in-flight call).
    """
    tenant_id = _unique_tenant("tenant-preflight-missing")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    project_iri = await _seed_project(tenant_id, secret_ref)  # secret never created

    async with tenant_connection(tenant_id) as conn:
        with pytest.raises(RunHalted):
            await default_preflight(
                conn,
                tenant_id=tenant_id,
                project_iri=project_iri,
                run_id=str(uuid.uuid4()),
                phase="run_start",
            )

    rows = await _preflight_rows(tenant_id, project_iri)

    assert len(rows) == 1
    assert rows[0]["result"] == "FAIL"
    assert rows[0]["payload"]["refs"][0]["ref"] == secret_ref
    assert rows[0]["payload"]["refs"][0]["ok"] is False

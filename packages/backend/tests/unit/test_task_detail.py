"""BE-V1-TASK-018 unit tests: `build/task_detail.py` -- AC-2/AC-4/AC-6.
Fakes both the `asyncpg.Connection` (same `_FakeConnection` pattern as
`test_audit_decisions.py`) and the S3 client -- no docker/Postgres needed.
"""

from __future__ import annotations

import json
from typing import Any

from botocore.exceptions import ClientError

from weave_backend.build.task_detail import (
    TaskRunFacts,
    get_task_detail,
    read_console_log,
    resolve_brief_decision_link,
)

_TENANT = "t1"
_PROJECT = "urn:weave:project:t1:acme"


class _FakeConnection:
    """Answers `get_task_brief`, `get_dep_summary`, and `list_decisions`'
    queries by SQL-text sniffing (same shape `test_audit_decisions.py` and
    `test_generation_store.py` both already use for their fakes).
    """

    def __init__(
        self,
        *,
        brief_row: dict[str, Any] | None = None,
        dep_summary_rows: dict[str, dict[str, Any]] | None = None,
        decision_rows: list[dict[str, Any]] | None = None,
    ) -> None:
        self._brief_row = brief_row
        self._dep_summary_rows = dep_summary_rows or {}
        self._decision_rows = decision_rows or []

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "task_briefs" in query:
            return self._brief_row
        if "dep_summaries" in query:
            task_id = args[-1]
            return self._dep_summary_rows.get(task_id)
        raise AssertionError(f"unexpected fetchrow query: {query}")

    async def fetch(self, _query: str, *_args: Any) -> list[dict[str, Any]]:
        return self._decision_rows


def _brief_row(*, blocked_by: list[str]) -> dict[str, Any]:
    return {
        "task_id": "task-2",
        "brief_iri": "urn:weave:brief:task-2",
        "schema_version": "1.0",
        "content": json.dumps({"dep_chain": {"blocked_by": blocked_by}, "adr_refs": ["ADR-017"]}),
        "created_at": None,
    }


def _decision_row(seq: int = 1) -> dict[str, Any]:
    return {
        "seq": seq,
        "ts": "2026-07-08T00:00:01+00:00",
        "actor_principal_iri": "urn:weave:principal:t1:human:alice",
        "event_type": "adr_recorded",
        "target_iri": _PROJECT,
        "diff_summary": json.dumps({"adr": "ADR-017"}),
    }


async def test_should_return_task_detail_payload_with_brief_and_handoff() -> None:
    conn = _FakeConnection(
        brief_row=_brief_row(blocked_by=["task-1"]),
        dep_summary_rows={
            "task-1": {
                "content": json.dumps(
                    {"task_id": "task-1", "decisions": ["use S3"], "edge_cases": [], "outputs": []}
                )
            }
        },
    )

    detail = await get_task_detail(
        conn,
        tenant_id=_TENANT,
        project_iri=_PROJECT,
        task_id="task-2",
        run_facts=TaskRunFacts(
            run_status="passed",
            run_id="run-1",
            log_location_ref="s3://bucket/tenant/t1/runs/run-1/run.ndjson",
            captures_manifest_ref=None,
        ),
    )

    assert detail.brief is not None
    assert detail.brief["adr_refs"] == ["ADR-017"]
    assert len(detail.handoff) == 1
    assert detail.handoff[0]["task_id"] == "task-1"
    assert detail.handoff[0]["decisions"] == ["use S3"]


async def test_should_link_brief_decision_to_decision_log_record() -> None:
    conn = _FakeConnection(decision_rows=[_decision_row()])

    record = await resolve_brief_decision_link(
        conn, tenant_id=_TENANT, project_iri=_PROJECT, adr_ref="ADR-017"
    )

    assert record is not None
    assert record.event_type == "adr_recorded"
    assert record.diff_summary == {"adr": "ADR-017"}


async def test_should_return_none_when_brief_decision_link_not_found() -> None:
    conn = _FakeConnection(decision_rows=[])

    record = await resolve_brief_decision_link(
        conn, tenant_id=_TENANT, project_iri=_PROJECT, adr_ref="ADR-999"
    )

    assert record is None


class _FakeS3Body:
    def __init__(self, data: bytes) -> None:
        self._data = data

    def read(self) -> bytes:
        return self._data


class _FakeS3Client:
    def __init__(self, *, objects: dict[str, bytes] | None = None) -> None:
        self._objects = objects or {}

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:
        full_key = f"{Bucket}/{Key}"
        if full_key not in self._objects:
            raise ClientError({"Error": {"Code": "NoSuchKey", "Message": "missing"}}, "GetObject")
        return {"Body": _FakeS3Body(self._objects[full_key])}


async def test_should_read_console_log_from_s3_when_finished() -> None:
    client = _FakeS3Client(
        objects={"weave-artefacts/tenant/t1/runs/run-1/run.ndjson": b'{"event": "plan"}'}
    )

    log_text = await read_console_log(
        client,
        bucket="weave-artefacts",
        log_location_ref="s3://weave-artefacts/tenant/t1/runs/run-1/run.ndjson",
    )

    assert log_text == '{"event": "plan"}'


async def test_should_return_none_when_console_log_pointer_unreadable() -> None:
    client = _FakeS3Client(objects={})

    log_text = await read_console_log(
        client, bucket="weave-artefacts", log_location_ref="s3://weave-artefacts/missing.ndjson"
    )

    assert log_text is None

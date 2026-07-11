"""BE-V1-TASK-018 unit tests: `build/run_log_sink.py` -- AC-1's NDJSON run-log
sink. Fakes both the S3 client (mirrors `storage/tenant_objects.py`'s
`put_object(client, bucket, key, body)` call shape) and the `asyncpg`
connection (same `_FakeConnection` pattern as `test_generation_store.py`) --
no docker/Postgres or LocalStack needed for these.
"""

from __future__ import annotations

from typing import Any

from botocore.exceptions import ClientError

from weave_backend.build.run_log_sink import RunLogSink


class _FakeConnection:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def execute(self, query: str, *args: Any) -> str:
        self.executed.append((query, args))
        return "UPDATE 1"


class _FakeS3Client:
    def __init__(self, *, raise_on_put: Exception | None = None) -> None:
        self.raise_on_put = raise_on_put
        self.puts: list[tuple[str, str, bytes]] = []

    def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> None:
        if self.raise_on_put is not None:
            raise self.raise_on_put
        self.puts.append((Bucket, Key, Body))


async def test_should_persist_run_log_and_set_location_ref() -> None:
    client = _FakeS3Client()
    sink = RunLogSink(
        tenant_id="t1", run_id="run-1", s3_client=client, bucket="weave-artefacts"
    )
    sink.emit({"event": "pdac_step", "step": "plan"})
    sink.emit({"event": "pdac_step", "step": "codify"})

    conn = _FakeConnection()
    await sink.close(conn)

    assert len(client.puts) == 1
    bucket, key, body = client.puts[0]
    assert bucket == "weave-artefacts"
    assert key == "tenant/t1/runs/run-1/run.ndjson"
    lines = body.decode().splitlines()
    assert len(lines) == 2
    assert '"step": "plan"' in lines[0]

    assert len(conn.executed) == 1
    query, args = conn.executed[0]
    assert "UPDATE generation_runs" in query
    assert "log_location_ref" in query
    assert args == ("s3://weave-artefacts/tenant/t1/runs/run-1/run.ndjson", "t1", "run-1")


async def test_should_disclose_and_continue_when_run_log_persist_fails(caplog: Any) -> None:
    client = _FakeS3Client(
        raise_on_put=ClientError({"Error": {"Code": "500", "Message": "boom"}}, "PutObject")
    )
    sink = RunLogSink(
        tenant_id="t1", run_id="run-2", s3_client=client, bucket="weave-artefacts"
    )
    sink.emit({"event": "pdac_step", "step": "plan"})

    conn = _FakeConnection()
    with caplog.at_level("WARNING"):
        await sink.close(conn)  # must not raise -- disclosed warning, never a run failure

    assert conn.executed == []
    assert any("run_log_persist_failed" in record.message for record in caplog.records)

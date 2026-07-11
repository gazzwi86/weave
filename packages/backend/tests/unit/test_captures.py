"""BE-V1-TASK-018 AC-7 unit tests: `build/captures.py`'s 8-state visual
capture producer. Fakes the S3 client (same `put_object(Bucket=, Key=,
Body=)` shape as `test_run_log_sink.py`) and stubs `capture_fn` -- no real
Playwright/browser needed for these.
"""

from __future__ import annotations

import json
from typing import Any

from botocore.exceptions import ClientError

from weave_backend.build.captures import (
    CAPTURE_STATES,
    CaptureRunContext,
    CaptureTask,
    StateNotExhibited,
    capture_visual_states,
)


class _FakeS3Client:
    def __init__(self, *, fail_on_key: str | None = None) -> None:
        self.fail_on_key = fail_on_key
        self.puts: dict[str, bytes] = {}

    def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> None:
        if self.fail_on_key is not None and self.fail_on_key in Key:
            raise ClientError({"Error": {"Code": "500", "Message": "boom"}}, "PutObject")
        self.puts[f"{Bucket}/{Key}"] = Body


def _capture_fn_all_states(_surface: str, state: str) -> bytes:
    if state == "loading":
        raise StateNotExhibited("surface has no loading state")
    return f"png-for-{state}".encode()


async def test_should_write_captures_manifest_for_ui_task_during_assess() -> None:
    client = _FakeS3Client()
    task = CaptureTask(has_ui_surface=True, primary_surface="/build/projects/x/settings")

    ctx = CaptureRunContext(
        tenant_id="t1", run_id="run-1", s3_client=client, bucket="weave-artefacts"
    )
    manifest = await capture_visual_states(ctx, task, _capture_fn_all_states)

    assert manifest is not None
    states = {e["state"]: e for e in manifest["states"]}
    assert len(states) == len(CAPTURE_STATES)
    assert states["default"]["status"] == "captured"
    assert states["loading"]["status"] == "absent"
    assert states["loading"]["reason"] == "surface has no loading state"

    assert "weave-artefacts/tenant/t1/runs/run-1/captures/default.png" in client.puts
    assert "weave-artefacts/tenant/t1/runs/run-1/captures/loading.png" not in client.puts
    manifest_body = client.puts["weave-artefacts/tenant/t1/runs/run-1/captures/manifest.json"]
    assert json.loads(manifest_body) == manifest


async def test_should_write_no_manifest_for_non_ui_task() -> None:
    client = _FakeS3Client()
    task = CaptureTask(has_ui_surface=False)

    ctx = CaptureRunContext(
        tenant_id="t1", run_id="run-2", s3_client=client, bucket="weave-artefacts"
    )
    manifest = await capture_visual_states(ctx, task, _capture_fn_all_states)

    assert manifest is None
    assert client.puts == {}


async def test_should_disclose_and_continue_when_capture_write_fails(caplog: Any) -> None:
    client = _FakeS3Client(fail_on_key="hover.png")
    task = CaptureTask(has_ui_surface=True, primary_surface="/build/x")

    ctx = CaptureRunContext(
        tenant_id="t1", run_id="run-3", s3_client=client, bucket="weave-artefacts"
    )
    with caplog.at_level("WARNING"):
        manifest = await capture_visual_states(ctx, task, _capture_fn_all_states)

    assert manifest is not None  # a per-state write failure never fails the whole run
    states = {e["state"]: e for e in manifest["states"]}
    assert states["hover"]["status"] == "absent"
    assert states["hover"]["reason"] == "capture_write_failed"
    assert any("captures_failed" in record.message for record in caplog.records)

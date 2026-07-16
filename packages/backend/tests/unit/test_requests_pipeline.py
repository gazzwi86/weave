"""BE-TASK-003 unit tests: the drafting pipeline (`run_drafting_pipeline`)
exercised directly with every collaborator faked -- no docker/Postgres/
Redis/LLM needed (Law F). Mirrors `test_notifications_dispatch.py`'s
`patch("...default_audit_emitter.emit", AsyncMock())` pattern and
`test_projects_router.py`'s `_fake_tenant_connection` async-context-manager
double.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from weave_backend.projects.ce_version_client import CeVersionUnavailable
from weave_backend.requests.pipeline import SECTIONS, DraftingRequest, run_drafting_pipeline
from weave_backend.requests.store import RequestRecord, create_request_record


class _RecordingProvider:
    """Fake `ModelProvider` that records every `(model_id, prompt)` pair it
    was asked to complete, returning a fixed section body immediately.
    """

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        self.calls.append((model_id, prompt))
        return f"draft-for:{model_id}"


class _FakeRedis:
    def __init__(self) -> None:
        self._hashes: dict[str, dict[str, object]] = {}
        self._lists: dict[str, list[str]] = {}

    async def hset(self, name: str, mapping: dict[str, object]) -> None:
        self._hashes.setdefault(name, {}).update({k: str(v) for k, v in mapping.items()})

    async def hgetall(self, name: str) -> dict[str, str]:
        return dict(self._hashes.get(name, {}))  # type: ignore[arg-type]

    async def expire(self, name: str, ttl: int) -> None:
        pass

    async def rpush(self, name: str, value: str) -> None:
        self._lists.setdefault(name, []).append(value)

    async def lrange(self, name: str, start: int, end: int) -> list[str]:
        values = self._lists.get(name, [])
        return values[start:] if end == -1 else values[start : end + 1]


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _ce_stub(
    status_code: int = 200, *, captured: list[httpx.Request] | None = None
) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        if captured is not None:
            captured.append(request)
        if status_code != 200:
            return httpx.Response(status_code)
        return httpx.Response(
            200,
            json={
                "versions": [
                    {
                        "version_iri": "urn:weave:version:v1",
                        "is_latest": True,
                    }
                ]
            },
        )

    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


def _draft_request(request_id: str = "r1", auth_header: str | None = None) -> DraftingRequest:
    return DraftingRequest(
        request_id=request_id,
        tenant_id="t1",
        actor_iri="urn:weave:principal:user:u1",
        prompt="p",
        auth_header=auth_header,
    )


async def test_drafting_uses_claude_fable_model_id() -> None:
    """AC-8: the pipeline must invoke only `claude-fable-5`, never any other
    model id, across all three sections.
    """
    redis_client = _FakeRedis()
    await create_request_record(
        redis_client,  # type: ignore[arg-type]
        RequestRecord(
            request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
        ),
    )
    provider = _RecordingProvider()

    with (
        patch("weave_backend.requests.pipeline.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.requests.pipeline.tenant_connection", _fake_tenant_connection),
    ):
        await run_drafting_pipeline(
            _draft_request(),
            ce_client=_ce_stub(),
            provider=provider,
            redis_client=redis_client,  # type: ignore[arg-type]
        )

    assert len(provider.calls) == len(SECTIONS)
    assert {model_id for model_id, _prompt in provider.calls} == {"claude-fable-5"}


async def test_drafting_logs_ce_read_call_to_audit() -> None:
    """AC-2: the pinned CE-VERSION-1 version IRI and the grounding SPARQL
    query text must be recorded via PLAT-AUDIT-1.
    """
    redis_client = _FakeRedis()
    await create_request_record(
        redis_client,  # type: ignore[arg-type]
        RequestRecord(
            request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
        ),
    )
    emit_mock = AsyncMock()

    with (
        patch("weave_backend.requests.pipeline.default_audit_emitter.emit", emit_mock),
        patch("weave_backend.requests.pipeline.tenant_connection", _fake_tenant_connection),
    ):
        await run_drafting_pipeline(
            _draft_request(),
            ce_client=_ce_stub(),
            provider=_RecordingProvider(),
            redis_client=redis_client,  # type: ignore[arg-type]
        )

    emit_mock.assert_awaited_once()
    assert emit_mock.await_args is not None
    _conn, event = emit_mock.await_args.args
    assert event.event_type == "ce_read_grounding"
    assert event.payload["version"] == "urn:weave:version:v1"
    assert "query" in event.payload


async def test_drafting_forwards_auth_header_to_ce_version_client() -> None:
    """The root cause fixed here: CE-VERSION-1 requires auth, so the
    submitter's bearer token (captured pre-backgrounding into
    `DraftingRequest.auth_header`) must reach the CE-VERSION-1 request or
    every call 401s and looks like CE is unreachable.
    """
    redis_client = _FakeRedis()
    await create_request_record(
        redis_client,  # type: ignore[arg-type]
        RequestRecord(
            request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
        ),
    )
    captured: list[httpx.Request] = []

    with (
        patch("weave_backend.requests.pipeline.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.requests.pipeline.tenant_connection", _fake_tenant_connection),
    ):
        await run_drafting_pipeline(
            _draft_request(auth_header="Bearer tok"),
            ce_client=_ce_stub(captured=captured),
            provider=_RecordingProvider(),
            redis_client=redis_client,  # type: ignore[arg-type]
        )

    assert captured[0].headers["authorization"] == "Bearer tok"


async def test_drafting_degrades_gracefully_when_ce_unreachable() -> None:
    """AC-7: CE-READ-1 unreachable -> graph_context "unavailable", draft
    continues (never blocked), and the degraded state persists to the
    request record.
    """
    redis_client = _FakeRedis()
    await create_request_record(
        redis_client,  # type: ignore[arg-type]
        RequestRecord(
            request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
        ),
    )
    provider = _RecordingProvider()

    with (
        patch(
            "weave_backend.requests.pipeline.get_pinned_latest_version",
            AsyncMock(side_effect=CeVersionUnavailable("down")),
        ),
        patch("weave_backend.requests.pipeline.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.requests.pipeline.tenant_connection", _fake_tenant_connection),
    ):
        await run_drafting_pipeline(
            _draft_request(),
            ce_client=_ce_stub(status_code=503),
            provider=provider,
            redis_client=redis_client,  # type: ignore[arg-type]
        )

    stored = await redis_client.hgetall("request:r1:record")
    assert stored["graph_context"] == "unavailable"
    assert len(provider.calls) == len(SECTIONS)


async def test_drafting_times_out_marks_request_and_fires_notify() -> None:
    """AC-4: a section draft that never returns within the timeout budget
    must terminate the stream, mark the request `timed_out`, preserve the
    partial draft, and fire a PLAT-NOTIFY-1 `generation_failure` event.
    """
    redis_client = _FakeRedis()
    await create_request_record(
        redis_client,  # type: ignore[arg-type]
        RequestRecord(
            request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
        ),
    )
    dispatch_mock = AsyncMock()

    async def _hang(*_args: object, **_kwargs: object) -> str:
        await asyncio.sleep(10)
        return "unreachable"

    with (
        patch("weave_backend.requests.pipeline._draft_section", _hang),
        patch("weave_backend.requests.pipeline.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.requests.pipeline.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.requests.pipeline.dispatch_notification", dispatch_mock),
    ):
        await run_drafting_pipeline(
            _draft_request(),
            ce_client=_ce_stub(),
            provider=_RecordingProvider(),
            redis_client=redis_client,  # type: ignore[arg-type]
            timeout_s=0.01,
        )

    stored = await redis_client.hgetall("request:r1:record")
    assert stored["status"] == "timed_out"
    dispatch_mock.assert_awaited_once()
    assert dispatch_mock.await_args is not None
    _conn, event = dispatch_mock.await_args.args
    assert event.event_type == "generation_failure"

    events_raw = redis_client._lists["request:r1:events"]
    assert events_raw[-1] == '{"done": true}'


async def test_drafting_per_section_read_timeout_marks_timed_out_with_reason() -> None:
    """The bug this closes: a per-section provider call that times out
    (`httpx.ReadTimeout`, e.g. a slow local Ollama model) is NOT an
    `asyncio.TimeoutError` -- it used to fall into the generic `except
    Exception` and get marked `failed` with no reason. It must be
    classified `timed_out` (same family as the overall-budget timeout),
    keep whatever sections drafted before the slow one, and carry a
    human-readable `reason`.
    """
    redis_client = _FakeRedis()
    await create_request_record(
        redis_client,  # type: ignore[arg-type]
        RequestRecord(
            request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
        ),
    )
    dispatch_mock = AsyncMock()

    async def _flaky(section: str, *_args: object, **_kwargs: object) -> str:
        if section == SECTIONS[0]:
            return "draft-for:brief"
        raise httpx.ReadTimeout("timed out waiting for the model")

    with (
        patch("weave_backend.requests.pipeline._draft_section", _flaky),
        patch("weave_backend.requests.pipeline.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.requests.pipeline.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.requests.pipeline.dispatch_notification", dispatch_mock),
    ):
        await run_drafting_pipeline(
            _draft_request(),
            ce_client=_ce_stub(),
            provider=_RecordingProvider(),
            redis_client=redis_client,  # type: ignore[arg-type]
        )

    stored = await redis_client.hgetall("request:r1:record")
    assert stored["status"] == "timed_out"
    assert SECTIONS[1] in stored["reason"]  # names the section that stalled
    assert json.loads(stored["draft_content"]) == {SECTIONS[0]: "draft-for:brief"}
    dispatch_mock.assert_awaited_once()
    assert dispatch_mock.await_args is not None
    _conn, event = dispatch_mock.await_args.args
    assert event.event_type == "generation_failure"
    assert event.payload["reason"] == stored["reason"]


async def test_drafting_other_provider_failure_marks_failed_with_reason() -> None:
    """Any other provider error (not a timeout of either kind) stays
    classified `failed`, but must now also carry a `reason` string
    instead of dying silently.
    """
    redis_client = _FakeRedis()
    await create_request_record(
        redis_client,  # type: ignore[arg-type]
        RequestRecord(
            request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
        ),
    )

    async def _boom(*_args: object, **_kwargs: object) -> str:
        raise ValueError("model returned malformed output")

    with (
        patch("weave_backend.requests.pipeline._draft_section", _boom),
        patch("weave_backend.requests.pipeline.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.requests.pipeline.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.requests.pipeline.dispatch_notification", AsyncMock()),
    ):
        await run_drafting_pipeline(
            _draft_request(),
            ce_client=_ce_stub(),
            provider=_RecordingProvider(),
            redis_client=redis_client,  # type: ignore[arg-type]
        )

    stored = await redis_client.hgetall("request:r1:record")
    assert stored["status"] == "failed"
    assert "model returned malformed output" in stored["reason"]


@pytest.mark.parametrize("section", SECTIONS)
async def test_build_section_prompt_includes_prompt_and_graph_context(section: str) -> None:
    from weave_backend.requests.pipeline import build_section_prompt

    rendered = build_section_prompt(section, "build a widget", "urn:weave:version:v1")

    assert "build a widget" in rendered
    assert "urn:weave:version:v1" in rendered

"""TASK-022: `connectors/client.py` -- the PLAT-CONNECTOR-1 instance
registry + health-read seam. Platform's real connector lands at v1.0
(CLAUDE.md Stack note); `StubConnectorClient` is the M1 default, honestly
always-empty/unavailable unless an instance is seeded via the
`BUILD_CONNECTOR_STUB_INSTANCES` env var -- the same seam docker-compose /
Playwright configure for out-of-process integration tests (Law F: no live
external call, ever).
"""

from __future__ import annotations

import json

import pytest

from weave_backend.connectors.client import (
    ConnectorUnavailable,
    StubConnectorClient,
)


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BUILD_CONNECTOR_STUB_INSTANCES", raising=False)


async def test_list_instances_empty_by_default() -> None:
    client = StubConnectorClient()

    instances = await client.list_instances("t1")

    assert instances == []


async def test_list_instances_reads_seeded_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "BUILD_CONNECTOR_STUB_INSTANCES",
        json.dumps([{"handle": "jira-1", "connector_type": "jira", "status": "ok"}]),
    )
    client = StubConnectorClient()

    instances = await client.list_instances("t1")

    assert len(instances) == 1
    assert instances[0].handle == "jira-1"
    assert instances[0].connector_type == "jira"


async def test_health_raises_unavailable_for_unknown_ref() -> None:
    client = StubConnectorClient()

    with pytest.raises(ConnectorUnavailable):
        await client.health("unknown-ref")


async def test_health_returns_seeded_instance_status(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "BUILD_CONNECTOR_STUB_INSTANCES",
        json.dumps([{"handle": "jira-1", "connector_type": "jira", "status": "ok"}]),
    )
    client = StubConnectorClient()

    health = await client.health("jira-1")

    assert health.status == "ok"
    assert health.error_count == 0
    assert health.skipped_count == 0

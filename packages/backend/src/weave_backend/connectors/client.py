"""TASK-022: the PLAT-CONNECTOR-1 instance registry + health-read seam.

Platform's real connector (Confluence/Jira/ServiceNow instance registry +
health read) is Platform-owned and lands at v1.0 -- Build never holds
connector credentials, it only reads instance handles and health through
this narrow interface, mirroring `notifications/slack_connector.py`'s
Protocol + Stub pattern for the same "deferred to v1.0" situation.

`StubConnectorClient` is the M1 default: instances are seeded only via the
`BUILD_CONNECTOR_STUB_INSTANCES` env var (a JSON array), never a live call
(Law F). This env var is also the seam out-of-process tests (docker
integration, Playwright E2E) use to configure a fake instance -- the same
way an operator would seed one -- without patching Python internals.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Protocol

_STUB_INSTANCES_ENV = "BUILD_CONNECTOR_STUB_INSTANCES"


class ConnectorUnavailable(Exception):
    """No instance is configured for this ref, or its health can't be read.
    AC-3: the caller must treat this as "unavailable", never fake green.
    """


@dataclass(frozen=True)
class ConnectorInstance:
    handle: str
    connector_type: str
    status: str = "ok"


@dataclass(frozen=True)
class ConnectorHealth:
    status: str
    last_sync: str | None
    last_error: str | None
    error_count: int
    skipped_count: int


class ConnectorClient(Protocol):
    async def list_instances(self, tenant_id: str) -> list[ConnectorInstance]: ...
    async def health(self, connector_ref: str) -> ConnectorHealth: ...


def _seeded_instances() -> list[ConnectorInstance]:
    raw = os.environ.get(_STUB_INSTANCES_ENV)
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except ValueError:
        return []
    return [
        ConnectorInstance(
            handle=item["handle"],
            connector_type=item["connector_type"],
            status=item.get("status", "ok"),
        )
        for item in data
    ]


class StubConnectorClient:
    """M1 default -- honest until Platform's real connector lands (v1.0)."""

    async def list_instances(self, tenant_id: str) -> list[ConnectorInstance]:
        return _seeded_instances()

    async def health(self, connector_ref: str) -> ConnectorHealth:
        match = next((i for i in _seeded_instances() if i.handle == connector_ref), None)
        if match is None:
            raise ConnectorUnavailable(connector_ref)
        return ConnectorHealth(
            status=match.status,
            last_sync=None,
            last_error=None,
            error_count=0,
            skipped_count=0,
        )


default_connector_client: ConnectorClient = StubConnectorClient()

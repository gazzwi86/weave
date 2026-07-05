"""AC-6: `security.*` -> PLAT-NOTIFY-1 fan-out against a stub connection and
a mocked `dispatch_notification` -- the real in-app delivery round trip is
proven by `tests/integration/test_audit_chain_api.py`.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

from weave_backend.audit.notify import SecurityEventContext, notify_tenant_admins_of_security_event

_TENANT = "tenant-abc"


class _FakeConnection:
    def __init__(self, admin_subs: list[str]) -> None:
        self.admin_subs = admin_subs

    async def fetch(self, _query: str, *_args: Any) -> list[dict[str, str]]:
        return [{"user_sub": sub} for sub in self.admin_subs]


def _context(**overrides: Any) -> SecurityEventContext:
    defaults: dict[str, Any] = {
        "tenant_id": _TENANT,
        "event_type": "security.permission.escalation",
        "actor_principal_iri": "urn:weave:principal:agent:intruder",
        "target_iri": "urn:weave:workspace:tenant-abc:ws-1",
        "audit_seq": 7,
    }
    return SecurityEventContext(**{**defaults, **overrides})


async def test_notify_dispatches_to_every_tenant_admin() -> None:
    conn = _FakeConnection(["u-admin-a", "u-admin-b"])

    with patch(
        "weave_backend.notifications.dispatch.dispatch_notification", new=AsyncMock()
    ) as mock_dispatch:
        await notify_tenant_admins_of_security_event(conn, _context())

    assert mock_dispatch.await_count == 2
    recipients = {call.args[1].recipient_iri for call in mock_dispatch.await_args_list}
    assert recipients == {
        "urn:weave:principal:user:u-admin-a",
        "urn:weave:principal:user:u-admin-b",
    }


async def test_notify_with_no_admins_dispatches_nothing() -> None:
    conn = _FakeConnection([])

    with patch(
        "weave_backend.notifications.dispatch.dispatch_notification", new=AsyncMock()
    ) as mock_dispatch:
        await notify_tenant_admins_of_security_event(conn, _context())

    mock_dispatch.assert_not_awaited()

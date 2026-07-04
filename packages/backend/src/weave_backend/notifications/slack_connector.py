"""M1 scope note (2026-07-02): PLAT-CONNECTOR-1 (the real Slack connector)
lands at v1.0. `dispatch.py` talks to Slack only through this narrow
`SlackConnector` interface, so a Slack-enabled preference works today
without a real connector -- every attempt short-circuits to
`SlackChannelUnavailable` (logged, never surfaced as an error; in-app
delivery already happened before any Slack attempt starts). Tests for the
AC-3/AC-4 Slack legs inject a double here instead of a real Slack client
(Law F -- no live SaaS calls).
"""

from __future__ import annotations

from typing import Any, Protocol


class SlackChannelUnavailable(Exception):
    """The connector has nothing to deliver to yet (M1: no real connector
    configured). Not a delivery failure -- no retry, no connector_health hit.
    """


class SlackDeliveryError(Exception):
    """A configured connector's attempt failed (timeout, API error) --
    retryable, and counts against connector_health (AC-4).
    """


class SlackConnector(Protocol):
    async def post_message(self, *, tenant_id: str, recipient_iri: str, text: str) -> None: ...


class StubSlackConnector:
    """M1 default connector -- always unavailable, by design."""

    async def post_message(self, *, tenant_id: str, recipient_iri: str, text: str) -> None:
        raise SlackChannelUnavailable(tenant_id)


default_slack_connector: SlackConnector = StubSlackConnector()


def format_slack_message(payload: dict[str, Any]) -> str:
    message = payload.get("message")
    return str(message) if message is not None else str(payload)

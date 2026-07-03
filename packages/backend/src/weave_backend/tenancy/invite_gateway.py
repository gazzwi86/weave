"""AC-2 deviation: no real Cognito invite/email integration exists yet. This
`Protocol` is the seam -- a `CognitoInviteGateway` implementation slots in
behind it later as an env-switch, not a rewrite. Dev/test wires the
recording fake below.
"""

from __future__ import annotations

from typing import Protocol


class InviteGateway(Protocol):
    async def send_invite(self, *, email: str, workspace_id: str, role: str) -> None: ...


class RecordingFakeInviteGateway:
    """Records every invite it's asked to send instead of emailing anyone --
    dev/test stand-in for Cognito-driven invite email delivery.
    """

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send_invite(self, *, email: str, workspace_id: str, role: str) -> None:
        self.sent.append({"email": email, "workspace_id": workspace_id, "role": role})


default_invite_gateway = RecordingFakeInviteGateway()


def get_invite_gateway() -> InviteGateway:
    return default_invite_gateway

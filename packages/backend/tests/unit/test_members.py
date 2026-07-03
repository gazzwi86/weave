"""PR #11 cleanup 6: `activate_member` on a workspace_id+email pair with no
matching invite row must raise a clear domain error, not crash opaquely
inside `_to_member(None)`.
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.tenancy.members import MemberNotFound, activate_member


class _FakeConnection:
    """Stands in for asyncpg.Connection: the `UPDATE ... RETURNING` in
    `activate_member` finds nothing when the workspace_id+email pair was
    never invited, so `fetchrow` returns `None` -- exactly what a real
    Postgres connection returns for a RETURNING clause matching zero rows.
    """

    async def fetchrow(self, query: str, *args: Any) -> None:
        return None


async def test_activate_member_raises_clear_error_when_no_matching_invite() -> None:
    with pytest.raises(MemberNotFound):
        await activate_member(
            _FakeConnection(),
            workspace_id="11111111-1111-1111-1111-111111111111",
            email="never-invited@example.com",
            user_sub="u-1",
        )

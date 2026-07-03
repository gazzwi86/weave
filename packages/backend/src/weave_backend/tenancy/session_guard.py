"""AC-3: enforces that a workspace-scoped request's token still matches the
current session version -- so a revoked member's *next* authenticated
request to a workspace-scoped route is rejected immediately, without
waiting for the token to expire.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.tenancy.sessions import get_session_version


async def require_active_session(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> Principal:
    current = await get_session_version(principal.tenant_id, principal.sub)
    if current != principal.session_version:
        raise HTTPException(status_code=401, detail={"error": "session_revoked"})
    return principal

"""AC-003-03: `corpus.retrieval_top_k` cascade resolution (PLAT-SETTINGS-1).
Mirrors `ingest/confidence.py::resolve_confidence_threshold` exactly --
`resolve_setting` has no built-in default, `DEFAULT_RETRIEVAL_TOP_K` is this
module's own business default when nothing is set anywhere in the cascade.
"""

from __future__ import annotations

import asyncpg

from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import workspace_iri

DEFAULT_RETRIEVAL_TOP_K = 8

RETRIEVAL_TOP_K_SETTING_KEY = "corpus.retrieval_top_k"


async def resolve_retrieval_top_k(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> int:
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=RETRIEVAL_TOP_K_SETTING_KEY,
            context_iri=workspace_iri(tenant_id, workspace_id),
        )
    except SettingNotFound:
        return DEFAULT_RETRIEVAL_TOP_K
    return int(resolved.value)

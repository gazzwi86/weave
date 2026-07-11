"""CE-V1-TASK-012: ingest pipeline spine (EPIC-012).

Upload -> async extraction job -> reviewable proposals -> accept/reject.
Graph mutation only ever happens via the CE-WRITE-1 dispatch
(`routers.operations._run_apply`) -- AC-001-08's structural CI assert
(`no-second-mutation-path-ingest`) checks that no module under this package
imports a store-level write/commit symbol directly; every graph/prov write
this pipeline needs lives in `weave_backend.operations` instead.
"""

from __future__ import annotations

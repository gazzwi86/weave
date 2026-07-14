"""ONB-V1-TASK-005 AC-005-04 / m2-delta.md §5: the competency-question
guidance checklist item (`add-competency-questions`, milestone id
`add_competency_questions`) makes zero CE calls and self-marks exactly once.

Two invariants, no new product code:

- `test_no_ce_calls_on_competency_path`: static grep proof (mirrors
  `recorder.py`'s own "grep-style enforcement" docstring convention) that
  neither the onboarding router nor the recorder import any CE HTTP client
  (`requests.ce_read`, `*ce_read_client*`, `standards.ce_client`,
  `sdkgen.ce_client`) -- the module tree the competency self-mark path runs
  through touches CE nowhere, so there is no count/read to fail (m2-delta
  §5: "no CE read, no poller extension, no count").
- `test_self_mark_idempotent`: the same `FakeConn` unit convention as
  `test_onboarding_recorder.py`, run against the competency milestone id --
  a second manual mark is a no-op (`won=False`), never a second outbox row.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from weave_backend.onboarding import recorder
from weave_backend.onboarding.recorder import record_milestone

# ponytail: local copy of test_onboarding_recorder.py's FakeConn -- tests/
# has no __init__.py (pytest rootdir collection), so a cross-file relative
# import isn't reliable; this fake is ~15 lines and small enough to just
# duplicate rather than restructure test packaging for one import.


class _NullTransaction:
    async def __aenter__(self) -> _NullTransaction:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        return None


@dataclass
class FakeConn:
    activations: set[tuple[str, str, str]] = field(default_factory=set)
    outbox_rows: list[dict[str, Any]] = field(default_factory=list)

    def transaction(self) -> _NullTransaction:
        return _NullTransaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "INSERT INTO activation" in query:
            tenant_id, user_id, milestone_id, _source = args
            key = (tenant_id, user_id, milestone_id)
            if key in self.activations:
                return None
            self.activations.add(key)
            return {"milestone_id": milestone_id}
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def execute(self, query: str, *args: Any) -> None:
        if "INSERT INTO outbox" in query:
            import json

            tenant_id, user_id, event_type, payload = args
            self.outbox_rows.append(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "event_type": event_type,
                    "payload": json.loads(payload),
                }
            )
            return
        raise AssertionError(f"unexpected execute: {query}")


_TENANT = "acme-corp"
_USER = "urn:weave:principal:user:u-1"
_COMPETENCY_MILESTONE_ID = "add_competency_questions"

_CE_CLIENT_IMPORT = re.compile(
    r"requests\.ce_read|ce_read_client|standards\.ce_client|sdkgen\.ce_client"
)
_ONBOARDING_MODULES = [
    Path(recorder.__file__).parent / "recorder.py",
    Path(recorder.__file__).parent.parent / "routers" / "onboarding.py",
]


def test_no_ce_calls_on_competency_path() -> None:
    for module_path in _ONBOARDING_MODULES:
        source = module_path.read_text()
        assert not _CE_CLIENT_IMPORT.search(source), f"{module_path} imports a CE client"


async def test_self_mark_idempotent() -> None:
    conn = FakeConn()

    first = await record_milestone(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        milestone_id=_COMPETENCY_MILESTONE_ID,
        source="manual",
    )
    second = await record_milestone(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        milestone_id=_COMPETENCY_MILESTONE_ID,
        source="manual",
    )

    assert first is True
    assert second is False
    assert len(conn.outbox_rows) == 1
    assert conn.outbox_rows[0]["payload"]["milestone_id"] == _COMPETENCY_MILESTONE_ID

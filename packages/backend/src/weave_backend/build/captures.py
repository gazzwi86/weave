"""BE-V1-TASK-018 AC-7: the 8-state visual-capture producer. Net-new --
nothing in M1/M2 writes `captures/manifest.json` (task brief). Rides the
QA/ASSESS lane's existing Playwright lane (`qa_suite._run_browser_backend`'s
sibling, invoked by the same caller once that lane passes) -- no new
browser infra, drives states with Playwright's own primitives via the
caller-supplied `capture_fn` (Implementation Hints).

Design Decisions: a state the surface cannot exhibit is recorded `absent`
with a reason, never a broken image (AC-3's honest-absence contract). A
capture producer crash is a disclosed `captures_failed` warning -- the
ASSESS verdict itself is never affected (same posture as the run-log sink).
Non-UI tasks never call this at all (caller checks `has_ui_surface`), so
they write no manifest.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

log = logging.getLogger(__name__)

#: Fixed list (Implementation Hints) -- order is the manifest/grid order.
CAPTURE_STATES: tuple[str, ...] = (
    "default",
    "hover",
    "focus",
    "active",
    "disabled",
    "loading",
    "empty",
    "error",
)


class StateNotExhibited(Exception):
    """Raised by `capture_fn` when the surface has no such state (e.g. a
    static page with no `loading` state) -- recorded `absent`, not a
    failure.
    """

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


@dataclass(frozen=True)
class CaptureTask:
    """The subset of a task's brief the producer needs (Law E grouping,
    mirrors `qa_suite.QAProject`'s caller-assembles-facts discipline).
    """

    has_ui_surface: bool
    primary_surface: str = ""


#: `(surface, state) -> PNG bytes`; raises `StateNotExhibited` for a state
#: the surface can't show. Caller supplies the real Playwright-backed
#: implementation; tests stub it.
CaptureFn = Callable[[str, str], bytes]


def _captures_prefix(tenant_id: str, run_id: str) -> str:
    return f"tenant/{tenant_id}/runs/{run_id}/captures"


def _capture_one(capture_fn: CaptureFn, surface: str, state: str) -> dict[str, Any]:
    try:
        return {"state": state, "status": "captured", "png": capture_fn(surface, state)}
    except StateNotExhibited as exc:
        return {"state": state, "status": "absent", "reason": exc.reason}


@dataclass(frozen=True)
class CaptureRunContext:
    """Grouped invocation context (Law E 5-parameter budget, same pattern
    as `qa_suite.QARunContext`).
    """

    tenant_id: str
    run_id: str
    s3_client: Any
    bucket: str


async def capture_visual_states(
    ctx: CaptureRunContext, task: CaptureTask, capture_fn: CaptureFn
) -> dict[str, Any] | None:
    """AC-7: drives the 8 fixed states for a UI-bearing task's primary
    surface. Returns the manifest dict written (or `None` when the task has
    no UI surface, or the S3 write itself failed -- both honest-absence
    cases AC-3's reader already handles).
    """
    if not task.has_ui_surface:
        return None

    prefix = _captures_prefix(ctx.tenant_id, ctx.run_id)
    entries: list[dict[str, Any]] = []
    for state in CAPTURE_STATES:
        result = _capture_one(capture_fn, task.primary_surface, state)
        png = result.pop("png", None)
        if png is not None:
            try:
                ctx.s3_client.put_object(Bucket=ctx.bucket, Key=f"{prefix}/{state}.png", Body=png)
            except (BotoCoreError, ClientError):
                log.warning("captures_failed", extra={"run_id": ctx.run_id, "state": state})
                result = {"state": state, "status": "absent", "reason": "capture_write_failed"}
        entries.append(result)

    manifest = {"states": entries}
    try:
        ctx.s3_client.put_object(
            Bucket=ctx.bucket,
            Key=f"{prefix}/manifest.json",
            Body=json.dumps(manifest).encode(),
        )
    except (BotoCoreError, ClientError):
        log.warning("captures_failed", extra={"run_id": ctx.run_id, "state": "manifest"})
        return None
    return manifest

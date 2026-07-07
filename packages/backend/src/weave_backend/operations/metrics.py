"""CloudWatch metric per mutation outcome (DoD: "CloudWatch metric emitted
per mutation outcome"). Same LocalStack-backed boto3 pattern as
`storage/tenant_objects.py` / `audit/signing_key.py`. Best-effort: a metrics
outage must never fail a mutation, so failures are logged, not raised.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import boto3

log = logging.getLogger(__name__)

_NAMESPACE = "Weave/ConstitutionEngine"


def _cloudwatch_client() -> Any:
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", "http://localhost:4566")
    return boto3.client(
        "cloudwatch",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",  # noqa: S106 -- LocalStack's well-known dummy creds, not a real secret
    )


def _put_metric(outcome: str) -> None:
    _cloudwatch_client().put_metric_data(
        Namespace=_NAMESPACE,
        MetricData=[
            {
                "MetricName": "OperationsApplyOutcome",
                "Dimensions": [{"Name": "outcome", "Value": outcome}],
                "Value": 1.0,
            }
        ],
    )


async def emit_mutation_outcome_metric(outcome: str) -> None:
    try:
        await asyncio.to_thread(_put_metric, outcome)
    except Exception:
        log.warning("failed to emit mutation outcome metric outcome=%s", outcome, exc_info=True)


# Strong refs to in-flight fire-and-forget tasks. asyncio only holds a weak
# reference to a task, so without this set an unreferenced task can be
# garbage-collected before it runs (CPython-documented gotcha).
_background_tasks: set[asyncio.Task[None]] = set()


def schedule_mutation_outcome_metric(outcome: str) -> None:
    """Fire-and-forget the best-effort metric emit so a CloudWatch round trip
    never sits on the write critical path (ADR-004 hotspot: ~90ms+ per apply
    against LocalStack, pushing write p95 over the 800ms M1 budget).

    The emit is already best-effort (failures are caught, never fail the
    mutation), so nothing depends on awaiting it. If there is no running event
    loop (sync context / shutdown), the metric is simply skipped.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop (sync context / shutdown). Return before creating the
        # coroutine so it can't leak un-awaited. Best-effort: metric is skipped.
        return
    task = loop.create_task(emit_mutation_outcome_metric(outcome))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

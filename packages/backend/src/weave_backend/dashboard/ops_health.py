"""AC-4: operational-health aggregation (S10). Reads the CloudWatch
metrics emitted by the structured-log/OTel pipeline (`Weave/Ops`
namespace, `engine` dimension) -- **never** `PLAT-AUDIT-1` (contracts.md
altitude note: audit is tamper-evident provenance, not ops telemetry).
One `GetMetricData` batch call covers all three metrics and both windows
(current + baseline) -- implementation hint, do not loop per metric/engine.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3

NAMESPACE = "Weave/Ops"
METRIC_NAMES = ("error_count", "retry_count", "agent_failure_count")


def cloudwatch_client() -> Any:
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", "http://localhost:4566")
    return boto3.client(
        "cloudwatch",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",  # noqa: S106 -- LocalStack's well-known dummy creds
    )


@dataclass(frozen=True)
class EngineRates:
    engine: str
    rates: dict[str, float]
    baseline: dict[str, float]


@dataclass(frozen=True)
class OpsHealthResult:
    rates_by_engine: list[EngineRates]
    spikes: list[EngineRates] = field(default_factory=list)


def _sum_datapoints(datapoints: list[dict[str, Any]]) -> float:
    return float(sum(dp.get("Sum", 0.0) for dp in datapoints))


def _query(
    client: Any, *, engines: list[str], start: datetime, end: datetime, period_s: int
) -> dict[str, dict[str, float]]:
    """One `GetMetricData` batch call for every (engine, metric) pair over
    a single window -- returns `{engine: {metric_name: total}}`.
    """
    queries = []
    for engine in engines:
        for metric_name in METRIC_NAMES:
            queries.append(
                {
                    "Id": f"m_{engine}_{metric_name}".replace("-", "_"),
                    "MetricStat": {
                        "Metric": {
                            "Namespace": NAMESPACE,
                            "MetricName": metric_name,
                            "Dimensions": [{"Name": "engine", "Value": engine}],
                        },
                        "Period": period_s,
                        "Stat": "Sum",
                    },
                }
            )
    if not queries:
        return {}
    response = client.get_metric_data(MetricDataQueries=queries, StartTime=start, EndTime=end)
    out: dict[str, dict[str, float]] = {engine: {} for engine in engines}
    for result in response.get("MetricDataResults", []):
        _, engine_part, metric_part = result["Id"].split("_", 2)
        out.setdefault(engine_part, {})[metric_part] = _sum_datapoints(
            [{"Sum": v} for v in result.get("Values", [])]
        )
    return out


def aggregate(
    client: Any,
    *,
    engines: list[str],
    window_days: int,
    spike_factor: float,
    now: datetime | None = None,
) -> OpsHealthResult:
    """AC-4: current-window rates vs the immediately-preceding baseline
    window, both requested in-memory (no stored baseline -- implementation
    hint).
    """
    now = now or datetime.now(UTC)
    window = timedelta(days=window_days)
    period_s = int(window.total_seconds())
    current = _query(client, engines=engines, start=now - window, end=now, period_s=period_s)
    baseline = _query(
        client,
        engines=engines,
        start=now - 2 * window,
        end=now - window,
        period_s=int(window.total_seconds()),
    )

    rates_by_engine = [
        EngineRates(engine=engine, rates=current.get(engine, {}), baseline=baseline.get(engine, {}))
        for engine in engines
    ]

    spikes = []
    for engine_rates in rates_by_engine:
        driving = {
            metric: rate
            for metric, rate in engine_rates.rates.items()
            if rate > spike_factor * engine_rates.baseline.get(metric, 0.0)
        }
        if driving:
            spikes.append(
                EngineRates(
                    engine=engine_rates.engine, rates=driving, baseline=engine_rates.baseline
                )
            )
    # Ranked by magnitude, driving series first (AC-4).
    spikes.sort(key=lambda er: max(er.rates.values(), default=0.0), reverse=True)

    return OpsHealthResult(rates_by_engine=rates_by_engine, spikes=spikes)

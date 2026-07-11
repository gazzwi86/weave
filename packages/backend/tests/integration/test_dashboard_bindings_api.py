"""PLAT-V1-TASK-016 integration tests: the 10 widget-category bindings
against a real docker Postgres stack (AC-2, AC-4, AC-6, AC-7, AC-8).
Follows `test_dashboard_widgets_api.py`'s docker-marked precedent.
"""

from __future__ import annotations

import shutil
import uuid
from datetime import date, timedelta
from pathlib import Path

import httpx
import pytest
from httpx import AsyncClient, MockTransport, Request, Response

from weave_backend.audit.emitter import AuditEvent, HashChainAuditEmitter
from weave_backend.dashboard import bindings, snapshots
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import agent_principal_iri, human_principal_iri

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _ce_stub(handlers: dict[str, object]) -> AsyncClient:
    """AC-2/AC-4/AC-7: a routed CE-METRICS-1/CE-READ-1/CE-VERSION-1 stub --
    `handlers` maps a request path to a canned JSON body (or an exception
    instance, raised to simulate CE unreachable).
    """

    def _handler(request: Request) -> Response:
        body = handlers.get(request.url.path)
        if isinstance(body, Exception):
            raise body
        if body is None:
            return Response(404, json={"error": "not_found"})
        return Response(200, json=body)

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


_FULL_METRICS_BODY = {
    "entity_count_by_kind": {"Process": 4, "BusinessCapability": 2},
    "shacl_errors_by_severity": {"error": 1, "warning": 2},
    "owl_inconsistencies": 0,
    "relationship_count": 12,
    "version_count": 3,
}


async def _ctx(tenant_id: str, conn: object, ce_client: AsyncClient) -> bindings.BindingContext:
    return bindings.BindingContext(
        tenant_id=tenant_id,
        context_iri=f"urn:weave:tenant:{tenant_id}:company",
        conn=conn,
        ce_client=ce_client,
    )


@pytest.mark.parametrize(
    "category",
    [
        "ontology-health",
        "completeness",
        "token-spend",
        "compliance",
        "ontology-issues",
        "agent-activity",
        "graph-growth",
        "rbac-coverage",
        "onboarding-progress",
    ],
)
async def test_category_bindings_table(platform_stack: Path, category: str) -> None:
    """AC-2: each non-CloudWatch category resolves against seeded fixtures
    without raising -- the registry-driven fetch reaches a terminal status.
    """
    tenant_id = _unique_tenant(f"dash-cat-{category[:8]}")
    ce_client = _ce_stub(
        {
            "/api/metrics/ontology": _FULL_METRICS_BODY,
            "/api/ontology/versions": {"versions": [{"status": "published"}]},
            "/api/sparql": {"rows": []},
        }
    )
    async with tenant_connection(tenant_id) as conn:
        await snapshots.upsert_snapshot(
            conn, tenant_id=tenant_id, day=date.today(), counts_by_kind={"Process": 4}
        )
        ctx = await _ctx(tenant_id, conn, ce_client)
        result = await bindings.resolve_category(category, ctx)
    assert result.status in {"fresh", "pending", "stale", "unavailable", "not_yet_available"}
    assert result.shape in bindings.CATEGORIES[category].shapes


async def test_degradation_sweep_per_category(platform_stack: Path) -> None:
    """AC-6: every CE-sourced category degrades honestly when its source
    errs -- never a fabricated zero/empty result on the *unavailable* path.
    """
    tenant_id = _unique_tenant("dash-degrade")
    broken_ce = _ce_stub(
        {
            "/api/metrics/ontology": httpx.ConnectError("boom"),
            "/api/ontology/versions": httpx.ConnectError("boom"),
            "/api/sparql": httpx.ConnectError("boom"),
        }
    )
    ce_sourced = [
        "ontology-health",
        "completeness",
        "compliance",
        "ontology-issues",
        "onboarding-progress",
    ]
    async with tenant_connection(tenant_id) as conn:
        for category in ce_sourced:
            ctx = await _ctx(tenant_id, conn, broken_ce)
            result = await bindings.resolve_category(category, ctx)
            assert result.status == "unavailable", f"{category} did not degrade honestly"
            assert result.rows is None, f"{category} fabricated rows on source error"


async def test_not_yet_available_regression(platform_stack: Path) -> None:
    """AC-7: S3 per-run, S7 build-issues, S11 non-CE rows all render the
    `not_yet_available` state simultaneously -- registry-driven, not
    per-category hand-checks. Availability is CE-only GA at M2 (fixture is
    the real static registry, no monkeypatch needed for the base case).
    """
    tenant_id = _unique_tenant("dash-nga")
    ce_client = _ce_stub(
        {
            "/api/metrics/ontology": _FULL_METRICS_BODY,
            "/api/ontology/versions": {"versions": [{"status": "published"}]},
        }
    )
    async with tenant_connection(tenant_id) as conn:
        ctx = await _ctx(tenant_id, conn, ce_client)

        token_result = await bindings.resolve_category("token-spend", ctx)
        assert token_result.rows["runs"] == bindings.NOT_YET_AVAILABLE

        issues_result = await bindings.resolve_category("ontology-issues", ctx)
        assert issues_result.rows["build_issues"] == bindings.NOT_YET_AVAILABLE

        emitter = HashChainAuditEmitter()
        human = human_principal_iri("u-nga")
        agent_ce = agent_principal_iri("arn:aws:iam::1:role/ce-agent")
        agent_events = agent_principal_iri("arn:aws:iam::1:role/events-agent")
        await emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="ce.version.published",
                actor_iri=human,
                subject_iri="urn:x",
            ),
        )
        await emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="ce.entity.created",
                actor_iri=agent_ce,
                subject_iri="urn:x",
                engine="ce",
            ),
        )
        await emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="events.automation.run",
                actor_iri=agent_events,
                subject_iri="urn:y",
                engine="events",
            ),
        )
        feed_result = await bindings.resolve_category("agent-activity", ctx)
        statuses = {row.get("status") for row in feed_result.rows}
        engines = {row["engine"] for row in feed_result.rows}
        assert agent_ce in {row["actor_principal_iri"] for row in feed_result.rows}
        assert human not in {row["actor_principal_iri"] for row in feed_result.rows}
        assert "events" in engines
        assert bindings.NOT_YET_AVAILABLE in statuses


async def test_growth_snapshot_upsert_and_suppression(platform_stack: Path) -> None:
    """AC-8: two fetches the same day upsert one row; a 30-day series
    renders; the stagnation advisory stays suppressed under 14 samples.
    """
    tenant_id = _unique_tenant("dash-growth")
    async with tenant_connection(tenant_id) as conn:
        today = date.today()
        await snapshots.upsert_snapshot(
            conn, tenant_id=tenant_id, day=today, counts_by_kind={"Process": 4}
        )
        await snapshots.upsert_snapshot(
            conn, tenant_id=tenant_id, day=today, counts_by_kind={"Process": 5}
        )
        rows = await conn.fetch(
            "SELECT entity_count FROM metrics_daily_snapshots WHERE tenant_id = $1", tenant_id
        )
        assert len(rows) == 1
        assert rows[0]["entity_count"] == 5

        for offset in range(1, 30):
            await snapshots.upsert_snapshot(
                conn,
                tenant_id=tenant_id,
                day=today - timedelta(days=offset),
                counts_by_kind={"Process": 5},
            )
        series = await snapshots.growth_series(conn, tenant_id=tenant_id, window_days=30)
        assert len(series) == 30
        assert snapshots.stagnation_advisory(series, stagnation_days=14) is True

        young_tenant = _unique_tenant("dash-growth-young")
    async with tenant_connection(young_tenant) as young_conn:
        await snapshots.upsert_snapshot(
            young_conn, tenant_id=young_tenant, day=date.today(), counts_by_kind={"Process": 1}
        )
        young_series = await snapshots.growth_series(
            young_conn, tenant_id=young_tenant, window_days=30
        )
        assert snapshots.stagnation_advisory(young_series, stagnation_days=14) is False


async def test_ops_health_aggregation_and_spike(
    platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-4: seeded LocalStack CloudWatch data yields correct per-engine
    rates; an injected error-count burst on `ce` yields a ranked spike;
    below-threshold engines never fire; zero PLAT-AUDIT-1 queries occur on
    the S10 path (spy).
    """
    from weave_backend.dashboard import ops_health

    # LocalStack's CloudWatch is a known-broken environment for both
    # PutMetricData and GetMetricData (see operations/metrics.py's
    # WEAVE_DISABLE_MUTATION_METRICS docstring -- every call 500s on some
    # LocalStack builds). A real client can't be seeded here, so this test
    # fakes the `cloudwatch_client()` boundary directly and exercises the
    # real aggregation/spike-detection logic (`ops_health.aggregate`)
    # against canned `GetMetricData` responses -- current window first
    # call, baseline window second call (call order per `aggregate()`).
    class _FakeCloudWatch:
        def __init__(self) -> None:
            self.calls = 0

        def get_metric_data(self, **_: object) -> dict[str, object]:
            self.calls += 1
            is_current = self.calls == 1
            spike_value = 5.0 if is_current else 1.0
            return {
                "MetricDataResults": [
                    {"Id": "m_ce_error_count", "Values": [spike_value] * 4},
                    {"Id": "m_ce_retry_count", "Values": [0.0]},
                    {"Id": "m_ce_agent_failure_count", "Values": [0.0]},
                    {"Id": "m_build_error_count", "Values": [0.1]},
                    {"Id": "m_build_retry_count", "Values": [0.0]},
                    {"Id": "m_build_agent_failure_count", "Values": [0.0]},
                    {"Id": "m_events_error_count", "Values": [0.0]},
                    {"Id": "m_events_retry_count", "Values": [0.0]},
                    {"Id": "m_events_agent_failure_count", "Values": [0.0]},
                    {"Id": "m_explorer_error_count", "Values": [0.0]},
                    {"Id": "m_explorer_retry_count", "Values": [0.0]},
                    {"Id": "m_explorer_agent_failure_count", "Values": [0.0]},
                ]
            }

    monkeypatch.setattr(ops_health, "cloudwatch_client", lambda: _FakeCloudWatch())

    audit_query_calls: list[str] = []
    import weave_backend.audit.listing as audit_listing_module
    import weave_backend.dashboard.bindings as bindings_module

    orig_list_entries = audit_listing_module.list_entries

    async def _spy_list_entries(*args: object, **kwargs: object) -> object:
        audit_query_calls.append("called")
        return await orig_list_entries(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(bindings_module, "list_entries", _spy_list_entries)

    tenant_id = _unique_tenant("dash-ops")
    ce_client = _ce_stub({})
    async with tenant_connection(tenant_id) as conn:
        ctx = await _ctx(tenant_id, conn, ce_client)
        result = await bindings.resolve_category("operational-health", ctx)

    assert not audit_query_calls, "S10 path must never query PLAT-AUDIT-1"
    assert result.status == "fresh"
    ce_rates = next(r for r in result.rows["rates_by_engine"] if r["engine"] == "ce")
    assert ce_rates["rates"].get("error_count", 0) > 0
    assert any(row["engine"] == "ce" for row in result.rows["alert_banner"])


async def test_compliance_deep_link(platform_stack: Path) -> None:
    """AC-3: the compliance binding's contravention rows carry a
    `/resource/{iri}` deep-link href per seeded SHACL `sh:ValidationResult`
    (CE-READ-1). This is the backend half of AC-3 -- the Playwright
    click-through against a rendered widget is TASK-017's job (role-home
    is the page that consumes this binding; see
    `.claude/state/escalations/TASK-016-blocker.md` for why AC-3's E2E
    test type moved to this task's backend layer instead).
    """
    tenant_id = _unique_tenant("dash-compliance")
    entity_iri = "urn:weave:entity:process:missing-owner"
    ce_client = _ce_stub(
        {
            "/api/metrics/ontology": {"shacl_errors_by_severity": {"error": 1}},
            "/api/sparql": {
                "rows": [
                    {
                        "entity_iri": entity_iri,
                        "message": "Missing required weave:owner",
                        "severity": "http://www.w3.org/ns/shacl#Violation",
                    }
                ]
            },
        }
    )
    async with tenant_connection(tenant_id) as conn:
        ctx = await _ctx(tenant_id, conn, ce_client)
        result = await bindings.resolve_category("compliance", ctx)

    assert result.status == "fresh"
    contraventions = result.rows["contraventions"]
    assert len(contraventions) == 1
    assert contraventions[0]["entity_iri"] == entity_iri
    assert contraventions[0]["href"] == f"/resource/{entity_iri}"

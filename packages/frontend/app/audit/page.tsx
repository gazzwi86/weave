"use client";

import Link from "next/link";

import { BarChartSlot as BarChart } from "@/components/templates/BarChartSlot";
import { KpiTileSlot as KpiTile } from "@/components/templates/KpiTileSlot";
import { Card, CardContent } from "@/components/ui/card";

import { useCompliance, type ComplianceSummary } from "./compliance/use-compliance";

function eventLogsHref(category: string): string {
  return `/audit/logs?event_type=${encodeURIComponent(category)}`;
}

function DashboardTiles({ summary }: { summary: ComplianceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-[var(--space-4)]">
      <div data-testid="chain-status">
        <KpiTile
          label="Chain status"
          value={summary.chain_status}
          variant={summary.chain_status === "valid" ? "success" : "danger"}
        />
      </div>
      <div data-testid="entries-checked">
        <KpiTile label="Entries checked" value={String(summary.entries_checked)} />
      </div>
    </div>
  );
}

function DashboardCard({ summary }: { summary: ComplianceSummary }) {
  const categories = Object.keys(summary.by_event_category);

  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {summary.period}
      </p>
      <CardContent className="flex flex-col gap-[var(--space-4)]">
        <DashboardTiles summary={summary} />

        <div>
          <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Events by category
          </p>
          <BarChart
            categories={categories}
            series={[{ label: summary.period, values: categories.map((c) => summary.by_event_category[c] ?? 0) }]}
            hrefFor={eventLogsHref}
          />
        </div>

        <div>
          <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Top actors
          </p>
          <ul data-testid="top-actors-list" className="flex flex-col gap-[var(--space-1)]">
            {summary.top_actors.map((actor) => (
              <li key={actor.principal_iri}>
                {actor.principal_iri}: {actor.event_count}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/** Audit trail dashboard: chain-verified badge + event volume over the
 * immutable log, from the same tenant-scoped `GET /api/audit/compliance`
 * summary the compliance sub-view uses (hence the shared hook). Row-level
 * inspection lives at /audit/logs.
 */
export default function AuditDashboardPage() {
  const { summary, loadError } = useCompliance();

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Audit trail
      </h1>

      <Link
        href="/audit/logs"
        className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
      >
        View logs
      </Link>

      {loadError && !summary && (
        <p data-testid="audit-error" className="text-[var(--color-text-muted)]">
          Unable to load the audit summary from the backend.
        </p>
      )}

      {summary && <DashboardCard summary={summary} />}
    </main>
  );
}

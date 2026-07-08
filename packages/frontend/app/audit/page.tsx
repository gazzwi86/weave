"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useCompliance, type ComplianceSummary } from "../compliance/use-compliance";

function ChainStatusBadge({ status }: { status: ComplianceSummary["chain_status"] }) {
  return status === "valid" ? (
    <Badge variant="success">valid</Badge>
  ) : (
    <Badge variant="danger">broken</Badge>
  );
}

function DashboardCard({ summary }: { summary: ComplianceSummary }) {
  const categories = Object.entries(summary.by_event_category);

  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {summary.period}
      </p>
      <CardContent className="flex flex-col gap-[var(--space-4)]">
        <p data-testid="chain-status">
          Chain status: <ChainStatusBadge status={summary.chain_status} />
        </p>
        <p data-testid="entries-checked">Entries checked: {summary.entries_checked}</p>

        <div>
          <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Events by category
          </p>
          <ul data-testid="event-category-list" className="flex flex-col gap-[var(--space-1)]">
            {categories.map(([category, count]) => (
              <li key={category}>
                <Link
                  href={`/audit/logs?event_type=${encodeURIComponent(category)}`}
                  className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
                >
                  {category}
                </Link>
                : {count}
              </li>
            ))}
          </ul>
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

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useCompliance, type ComplianceSummary } from "./use-compliance";

function ChainStatusBadge({ status }: { status: ComplianceSummary["chain_status"] }) {
  return status === "valid" ? (
    <Badge variant="success">valid</Badge>
  ) : (
    <Badge variant="danger">broken</Badge>
  );
}

function SummaryCard({ summary }: { summary: ComplianceSummary }) {
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
            By event category
          </p>
          <ul data-testid="event-category-list" className="flex flex-col gap-[var(--space-1)]">
            {categories.map(([category, count]) => (
              <li key={category}>
                {category}: {count}
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

/** PLAT-TASK-009 AC-7: compliance sub-view. The backend's
 * `GET /api/audit/compliance` response shape never includes `diff_summary`
 * for any role -- redaction is structural, so this page has no raw diff
 * payload to accidentally render.
 */
export default function CompliancePage() {
  const { summary, loadError } = useCompliance();

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Audit compliance
      </h1>

      {loadError && !summary && (
        <p data-testid="compliance-error" className="text-[var(--color-text-muted)]">
          Unable to load the compliance summary from the backend.
        </p>
      )}

      {summary && <SummaryCard summary={summary} />}
    </main>
  );
}

"use client";

import Link from "next/link";

import { BarChartSlot as BarChart } from "@/components/templates/BarChartSlot";
import { Card, CardContent } from "@/components/ui/card";
import { ChainStatusChip } from "@/components/ui/chain-status-chip";
import { Eyebrow } from "@/components/ui/eyebrow";

import { useCompliance, type ComplianceSummary, type TargetCount } from "./compliance/use-compliance";

function eventLogsHref(category: string): string {
  return `/audit/logs?event_type=${encodeURIComponent(category)}`;
}

/** "urn:weave:process:order-handling" -> "order-handling". Same last-segment
 * friendly-label rule the top-actors list uses; the raw IRI stays available
 * as the row title for reference. */
function friendlyEntity(iri: string): string {
  return iri.split(/[:/]/).filter(Boolean).at(-1) ?? iri;
}

/** refit-mock.html "Model edits by kind" side-card -- no backend field
 * carries a per-kind edit breakdown (G5 has no backing endpoint), so this
 * always renders the honest pending state rather than fake data. */
function ModelEditsByKindCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <Eyebrow>Model edits by kind — this month</Eyebrow>
        <p data-testid="kind-edits-pending" className="text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">
          Not available yet — per-kind edit counts need a backend breakdown.
        </p>
      </CardContent>
    </Card>
  );
}

function BusiestEntitiesList({ targets }: { targets: TargetCount[] }) {
  return (
    <ul className="flex flex-col gap-[var(--space-1)]">
      {targets.map((target) => (
        <li
          key={target.target_iri}
          title={target.target_iri}
          className="flex items-center justify-between text-[length:var(--text-body-sm)]"
        >
          <span className="text-[var(--color-text-default)]">{friendlyEntity(target.target_iri)}</span>
          <span className="font-[var(--font-mono)] tabular-nums text-[var(--color-text-muted)]">
            {target.count.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** refit-mock.html "Busiest entities" side-card -- backed by `top_targets`
 * (G7, `feat/audit-aggregation-gaps` PR #135, unmerged). Absent means
 * "pending", not "zero busiest entities" -- see `use-compliance.ts`. */
/** The header above already carries the page's one "View logs" hyperlink --
 * a second anchor with the same accessible name here would make
 * `getByRole("link", { name: "View logs" })` ambiguous, so this card is
 * navigation-free (refit-mock.html's ghost button is decorative parity we
 * skip; the header link covers the same journey). */
function BusiestEntitiesCard({ targets }: { targets: TargetCount[] | undefined }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <Eyebrow>Busiest entities — 30 days</Eyebrow>
        {targets ? (
          <BusiestEntitiesList targets={targets} />
        ) : (
          <p data-testid="busiest-entities-pending" className="text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">
            Not available yet — busiest-entity ranking needs a backend breakdown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Current-vs-previous category series; falls back to the current period
 * alone when there is no prior period (the BarChart renders its own empty
 * state if even the current period has no categories). */
function EventsByCategoryCard({
  summary,
  previous,
}: {
  summary: ComplianceSummary;
  previous: ComplianceSummary | null;
}) {
  const categories = Object.keys(summary.by_event_category);
  const series = [
    ...(previous
      ? [{ label: previous.period, values: categories.map((c) => previous.by_event_category[c] ?? 0) }]
      : []),
    { label: summary.period, values: categories.map((c) => summary.by_event_category[c] ?? 0) },
  ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <Eyebrow>Events by category — vs last month</Eyebrow>
        <BarChart categories={categories} series={series} hrefFor={eventLogsHref} />
      </CardContent>
    </Card>
  );
}

/** refit-mock.html Security/Governance/Budget/Reliability health row -- none
 * of these counts have a backing endpoint yet (G6), so every card renders
 * the same honest pending state. */
function EventCountsRow() {
  const groups = ["Security", "Governance", "Budget", "Reliability"];
  return (
    <div className="grid grid-cols-2 gap-[var(--space-4)] md:grid-cols-4">
      {groups.map((group) => (
        <Card key={group}>
          <CardContent className="flex flex-col gap-[var(--space-2)]">
            <Eyebrow>{group}</Eyebrow>
            <p data-testid="event-counts-pending" className="text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">
              Not available yet.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AuditBody({ summary, previous }: { summary: ComplianceSummary; previous: ComplianceSummary | null }) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-3">
        <ModelEditsByKindCard />
        <BusiestEntitiesCard targets={summary.top_targets} />
        <EventsByCategoryCard summary={summary} previous={previous} />
      </div>
      <EventCountsRow />
    </div>
  );
}

/** Audit trail dashboard (refit-mock.html "Dashboard"): activity and
 * operations at a glance -- the chain-status chip is a summary link through
 * to /audit/compliance, which carries the full trust verdict. Backed by the
 * same tenant-scoped `GET /api/audit/compliance` summary the Compliance page
 * uses; row-level inspection lives at /audit/logs.
 */
export default function AuditDashboardPage() {
  const { summary, previous, loadError } = useCompliance();

  return (
    <main className="flex flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <div>
          <Eyebrow tone="accent">Audit trail</Eyebrow>
          <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Dashboard
          </h1>
          <p className="mt-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            What&apos;s happening across the workspace — every event, signed and chained.{" "}
            <Link href="/audit/logs" className="text-[var(--color-accent-primary)] hover:underline">
              View logs
            </Link>
          </p>
        </div>
        {summary && (
          <ChainStatusChip status={summary.chain_status} href="/audit/compliance" data-testid="chain-status" />
        )}
      </div>

      {loadError && !summary && (
        <p data-testid="audit-error" className="text-[var(--color-text-muted)]">
          Unable to load the audit summary from the backend.
        </p>
      )}

      {summary && <AuditBody summary={summary} previous={previous} />}
    </main>
  );
}

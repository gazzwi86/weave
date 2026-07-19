"use client";

import Link from "next/link";

import { BarChartSlot as BarChart } from "@/components/templates/BarChartSlot";
import { Card, CardContent } from "@/components/ui/card";
import { ChainStatusChip } from "@/components/ui/chain-status-chip";
import { Eyebrow } from "@/components/ui/eyebrow";

import { useCompliance, type ComplianceSummary, type TargetCount } from "./compliance/use-compliance";
import { EVENT_COUNT_GROUPS } from "./event-count-groups";
import { sumEventCounts, useEventCounts, type EventCounts } from "./use-event-counts";
import { useKindCounts, type KindCounts } from "./use-kind-counts";

function eventLogsHref(category: string): string {
  return `/audit/logs?event_type=${encodeURIComponent(category)}`;
}

/** "urn:weave:process:order-handling" -> "order-handling". Same last-segment
 * friendly-label rule the top-actors list uses; the raw IRI stays available
 * as the row title for reference. */
function friendlyEntity(iri: string): string {
  return iri.split(/[:/]/).filter(Boolean).at(-1) ?? iri;
}

function PendingNote({ testId, children }: { testId: string; children: string }) {
  return (
    <p data-testid={testId} className="text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">
      {children}
    </p>
  );
}

function KindCountsList({ counts }: { counts: Record<string, number> }) {
  const rows = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return (
    <ul className="flex flex-col gap-[var(--space-1)]">
      {rows.map(([kind, count]) => (
        <li key={kind} className="flex items-center justify-between text-[length:var(--text-body-sm)]">
          <span className="text-[var(--color-text-default)]">{kind}</span>
          <span className="font-[var(--font-mono)] tabular-nums text-[var(--color-text-muted)]">
            {count.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** refit-mock.html "Model edits by kind" side-card -- G5 embeds a per-kind
 * breakdown on every `operations.applied` audit event; `useKindCounts` sums
 * it across this month's entries. Three states: pending (denied/error),
 * genuinely empty (loaded, zero edits this month), or a populated list --
 * an empty object is a real zero, never confused with "not available". */
function ModelEditsByKindCard({ state }: { state: KindCounts }) {
  const { denied, loadError, counts } = state;
  if (denied || loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-[var(--space-2)]">
          <Eyebrow>Model edits by kind — this month</Eyebrow>
          <PendingNote testId="kind-edits-pending">
            {denied ? "Only workspace admins can see this." : "Not available yet — couldn't load this from the backend."}
          </PendingNote>
        </CardContent>
      </Card>
    );
  }
  const hasCounts = counts && Object.keys(counts).length > 0;
  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <Eyebrow>Model edits by kind — this month</Eyebrow>
        {hasCounts && <KindCountsList counts={counts} />}
        {counts !== null && !hasCounts && (
          <PendingNote testId="kind-edits-empty">No model edits recorded this period.</PendingNote>
        )}
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
 * (G7, landed). The backend always returns an array now (possibly empty),
 * so "pending" here means "no busiest entities this period", the honest
 * empty state rather than a stale "needs a backend breakdown" claim. */
/** The header above already carries the page's one "View logs" hyperlink --
 * a second anchor with the same accessible name here would make
 * `getByRole("link", { name: "View logs" })` ambiguous, so this card is
 * navigation-free (refit-mock.html's ghost button is decorative parity we
 * skip; the header link covers the same journey). */
function BusiestEntitiesCard({ targets }: { targets: TargetCount[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <Eyebrow>Busiest entities — 30 days</Eyebrow>
        {targets.length > 0 ? (
          <BusiestEntitiesList targets={targets} />
        ) : (
          <PendingNote testId="busiest-entities-pending">No busiest entities recorded this period.</PendingNote>
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

/** One metric row within a health group -- pending when the whole group's
 * fetch is denied/errored/loading, OR when this specific metric has no
 * backend `event_type` source yet (`eventTypes === null`, see
 * `event-count-groups.ts`) regardless of the rest of the card. */
function EventCountRow({
  label,
  eventTypes,
  counts,
  wholeRowPending,
}: {
  label: string;
  eventTypes: string[] | null;
  counts: Record<string, number> | null;
  wholeRowPending: boolean;
}) {
  const pending = eventTypes === null || wholeRowPending;
  return (
    <li className="flex items-center justify-between text-[length:var(--text-body-sm)]">
      <span className="text-[var(--color-text-default)]">{label}</span>
      {pending ? (
        <span data-testid="event-counts-pending" className="text-[var(--color-text-subtle)]">
          Not available yet
        </span>
      ) : (
        <span className="font-[var(--font-mono)] tabular-nums text-[var(--color-text-muted)]">
          {sumEventCounts(counts, eventTypes).toLocaleString()}
        </span>
      )}
    </li>
  );
}

/** refit-mock.html Security/Governance/Budget/Reliability health row -- G6
 * (event_type counts) + G8 (audit_outages folded into the same counts call).
 * A denied/errored fetch pends every row uniformly (see
 * `use-event-counts.ts`); a successful fetch still leaves "Policies changed"
 * pending on its own (no backend source, see `event-count-groups.ts`). */
function EventCountsRow({ state }: { state: EventCounts }) {
  const wholeRowPending = state.denied || state.loadError || state.counts === null;
  return (
    <div className="grid grid-cols-2 gap-[var(--space-4)] md:grid-cols-4">
      {EVENT_COUNT_GROUPS.map((group) => (
        <Card key={group.name}>
          <CardContent className="flex flex-col gap-[var(--space-2)]">
            <Eyebrow>{group.name}</Eyebrow>
            <ul className="flex flex-col gap-[var(--space-1)]">
              {group.metrics.map((metric) => (
                <EventCountRow
                  key={metric.label}
                  label={metric.label}
                  eventTypes={metric.eventTypes}
                  counts={state.counts}
                  wholeRowPending={wholeRowPending}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AuditBody({
  summary,
  previous,
  kindCounts,
  eventCounts,
}: {
  summary: ComplianceSummary;
  previous: ComplianceSummary | null;
  kindCounts: KindCounts;
  eventCounts: EventCounts;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-3">
        <ModelEditsByKindCard state={kindCounts} />
        <BusiestEntitiesCard targets={summary.top_targets} />
        <EventsByCategoryCard summary={summary} previous={previous} />
      </div>
      <EventCountsRow state={eventCounts} />
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
  const kindCounts = useKindCounts();
  const eventCounts = useEventCounts();

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

      {summary && (
        <AuditBody summary={summary} previous={previous} kindCounts={kindCounts} eventCounts={eventCounts} />
      )}
    </main>
  );
}

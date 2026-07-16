"use client";

import Link from "next/link";

import { BarChartSlot as BarChart } from "@/components/templates/BarChartSlot";
import { KpiTileSlot as KpiTile } from "@/components/templates/KpiTileSlot";
import { Card, CardContent } from "@/components/ui/card";

import { useCompliance, type ComplianceSummary } from "./compliance/use-compliance";

function eventLogsHref(category: string): string {
  return `/audit/logs?event_type=${encodeURIComponent(category)}`;
}

/** "urn:weave:principal:user:admin" -> "admin". Friendly label for the top-
 * actors list (v5 mock) -- the raw IRI stays in the row title for reference.
 * ponytail: last-segment split, no directory lookup; swap for a name service
 * if actors ever need real display names. */
function friendlyActor(principalIri: string): string {
  return principalIri.split(/[:/]/).filter(Boolean).at(-1) ?? principalIri;
}

/** SHACL pass rate as a percentage of all validated writes, or null when
 * there were none this period (renders an empty tile, not a fake 0%). */
function shaclRate(summary: ComplianceSummary): string | undefined {
  // ?? 0: a backend that omits these must not white-screen the whole page.
  const validated = summary.shacl_validated ?? 0;
  const total = validated + (summary.shacl_rejections ?? 0);
  if (total === 0) return undefined;
  return `${((validated / total) * 100).toFixed(1)}%`;
}

function KpiGrid({ summary }: { summary: ComplianceSummary }) {
  const rate = shaclRate(summary);
  return (
    <div className="grid grid-cols-2 gap-[var(--space-4)] md:grid-cols-4">
      <div data-testid="chain-status">
        <KpiTile
          label="Chain status"
          value={summary.chain_status === "valid" ? "Valid" : "Broken"}
          variant={summary.chain_status === "valid" ? "success" : "danger"}
        />
      </div>
      <div data-testid="entries-checked">
        <KpiTile label="Entries checked" value={summary.entries_checked.toLocaleString()} />
      </div>
      <div data-testid="shacl-validated">
        <KpiTile label="SHACL validated" value={rate} empty={rate === undefined} variant="success" />
      </div>
      <div data-testid="shacl-rejections">
        <KpiTile
          label="SHACL rejections"
          value={(summary.shacl_rejections ?? 0).toLocaleString()}
          variant={(summary.shacl_rejections ?? 0) > 0 ? "warn" : "default"}
        />
      </div>
    </div>
  );
}

/** Current-vs-previous category series; falls back to the current period
 * alone when there is no prior period (the BarChart renders its own empty
 * state if even the current period has no categories). */
function CategoryChart({
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
    <div>
      <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Entries by category{previous ? " — this period vs previous" : ""}
      </p>
      <div className="mt-[var(--space-1)] flex gap-[var(--space-4)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        {previous ? (
          <span className="flex items-center gap-[var(--space-1)]">
            <span aria-hidden="true" className="size-[var(--space-2)] rounded-[var(--radius-full)] bg-[var(--color-border-strong)]" />
            {previous.period}
          </span>
        ) : null}
        <span className="flex items-center gap-[var(--space-1)]">
          <span aria-hidden="true" className="size-[var(--space-2)] rounded-[var(--radius-full)] bg-[var(--color-accent-primary)]" />
          {summary.period}
        </span>
      </div>
      <BarChart categories={categories} series={series} hrefFor={eventLogsHref} />
    </div>
  );
}

function AuditBody({ summary, previous }: { summary: ComplianceSummary; previous: ComplianceSummary | null }) {
  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      <KpiGrid summary={summary} />
      <Card>
        <CardContent className="flex flex-col gap-[var(--space-5)]">
          <CategoryChart summary={summary} previous={previous} />
          <div>
            <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">Top actors</p>
            <ul data-testid="top-actors-list" className="mt-[var(--space-2)] flex flex-col gap-[var(--space-1)]">
              {summary.top_actors.map((actor) => (
                <li
                  key={actor.principal_iri}
                  title={actor.principal_iri}
                  className="flex items-center justify-between text-[length:var(--text-body-sm)]"
                >
                  <span className="text-[var(--color-text-default)]">{friendlyActor(actor.principal_iri)}</span>
                  <span className="font-[var(--font-mono)] tabular-nums text-[var(--color-text-muted)]">
                    {actor.event_count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Audit trail dashboard (v5): chain-health + throughput KPI tiles and a
 * period-over-period category chart over the immutable log, from the same
 * tenant-scoped `GET /api/audit/compliance` summary the compliance sub-view
 * uses. Row-level inspection lives at /audit/logs. */
export default function AuditDashboardPage() {
  const { summary, previous, loadError } = useCompliance();

  return (
    <main className="flex flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div>
        <p className="text-[length:var(--text-overline)] font-[var(--font-weight-semibold)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-accent-primary)]">
          Audit engine
        </p>
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Audit trail
        </h1>
        <p className="mt-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          Tamper-evident, hash-chained record of every write — at-a-glance chain health, throughput, and
          period-over-period volume.{" "}
          <Link href="/audit/logs" className="text-[var(--color-accent-primary)] hover:underline">
            View logs
          </Link>
        </p>
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

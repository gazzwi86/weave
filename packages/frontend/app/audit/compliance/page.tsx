"use client";

import Link from "next/link";

import { BarChartSlot as BarChart } from "@/components/templates/BarChartSlot";
import { KpiTileSlot as KpiTile } from "@/components/templates/KpiTileSlot";
import { Card, CardContent } from "@/components/ui/card";

import { useCompliance, type ComplianceSummary } from "./use-compliance";

function eventLogsHref(category: string): string {
  return `/audit/logs?event_type=${encodeURIComponent(category)}`;
}

/** AC-1: chain-status/entries-checked/SHACL figures as `KpiTile` tiles,
 * not plain `<p>` text rows -- closes F-D21's tile finding. */
function SummaryTiles({ summary }: { summary: ComplianceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-[var(--space-4)] sm:grid-cols-4">
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
      <div data-testid="shacl-validated">
        <KpiTile label="SHACL validated" value={String(summary.shacl_validated)} />
      </div>
      <div data-testid="shacl-rejections">
        <KpiTile
          label="SHACL rejections"
          value={String(summary.shacl_rejections)}
          variant={summary.shacl_rejections > 0 ? "warn" : "default"}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  summary,
  previous,
}: {
  summary: ComplianceSummary;
  previous: ComplianceSummary | null;
}) {
  const categories = Object.keys(summary.by_event_category);

  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {summary.period}
      </p>
      <CardContent className="flex flex-col gap-[var(--space-4)]">
        <SummaryTiles summary={summary} />

        <div>
          <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            By event category -- current vs previous period
          </p>
          {/* AC-2: BarChart replaces the "▲ 1" text-glyph CategoryDelta;
           * AC-3: category bars drill into /audit/logs, pre-filtered. */}
          <BarChart
            categories={categories}
            series={
              previous
                ? [
                    {
                      label: previous.period,
                      values: categories.map((c) => previous.by_event_category[c] ?? 0),
                    },
                    {
                      label: summary.period,
                      values: categories.map((c) => summary.by_event_category[c] ?? 0),
                    },
                  ]
                : []
            }
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

function ConformanceCard({ summary }: { summary: ComplianceSummary }) {
  return (
    <Card>
      {/* Plain text, not CardTitle -- same heading-order trap billing/page.tsx documents. */}
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Model conformance
      </p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <p>
          Every write is SHACL-validated at the door (CE-WRITE-1) — the published graph is
          conformant by construction.
        </p>
        <Link
          href="/ce/types"
          className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
        >
          View kinds & shape constraints
        </Link>
      </CardContent>
    </Card>
  );
}

/** PLAT-TASK-009 AC-7 / TASK-029 AC-1/2/3: compliance sub-view -- KpiTile
 * summary tiles, month-over-month BarChart per event category, plus a
 * SHACL-conformance hub. The backend's `GET /api/audit/compliance` response
 * shape never includes `diff_summary` for any role -- redaction is
 * structural, so this page has no raw diff payload to accidentally render.
 * Canonical route per AC-6 (`visual-direction.md` "Compliance placement");
 * legacy `/compliance` redirects here (`next.config.ts`).
 */
export default function CompliancePage() {
  const { summary, previous, loadError } = useCompliance();

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

      {summary && <SummaryCard summary={summary} previous={previous} />}
      {summary && <ConformanceCard summary={summary} />}
    </main>
  );
}

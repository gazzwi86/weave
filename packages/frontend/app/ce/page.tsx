"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExplainBand } from "@/components/ui/explain-band";
import { KpiTileSlot } from "@/components/templates/KpiTileSlot";
import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";
import { RelativeTimeSlot } from "@/components/templates/RelativeTimeSlot";

import { useOverview, type OverviewStats } from "./use-overview";
import type { VersionEntry } from "./versions/types";

const QUICK_LINKS = [
  { label: "Explore", href: "/explorer" },
  { label: "Query", href: "/ce/query" },
  { label: "Ontology / Types", href: "/ce/types" },
  { label: "Instances", href: "/ce/instances" },
  { label: "Glossary", href: "/ce/glossary" },
  { label: "Rules & policies", href: "/ce/rules" },
  { label: "Audit trail", href: "/audit" },
] as const;

function KindRow({ label, colour, count }: { label: string; colour: string; count: number }) {
  return (
    <li className="flex items-center gap-[var(--space-2)]">
      <span
        aria-hidden="true"
        className="inline-block size-[var(--space-3)] rounded-[var(--radius-full)]"
        style={{ backgroundColor: colour }}
      />
      <span className="flex-1">{label}</span>
      <span className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {count}
      </span>
    </li>
  );
}

/** Headline numbers as flat KPI tiles rather than buried in paragraph text
 * -- the mock's "widgets" treatment for the model's vital stats. */
function KpiRow({ stats }: { stats: OverviewStats }) {
  return (
    <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3">
      <KpiTileSlot label="Instances" value={String(stats.totalInstances)} />
      <KpiTileSlot label="Triples loaded" value={String(stats.totalTriples)} />
      <KpiTileSlot
        label="Published version"
        value={stats.publishedSemver ? `v${stats.publishedSemver}` : undefined}
        empty={!stats.publishedSemver}
      />
    </div>
  );
}

function ModelByKindCard({ stats }: { stats: OverviewStats }) {
  const used = stats.kinds.filter((kind) => (stats.countsByKind[kind.id] ?? 0) > 0);
  const unusedCount = stats.kinds.length - used.length;

  return (
    <Card>
      {/* Plain text, not CardTitle -- same heading-order trap billing/page.tsx documents. */}
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Model by kind
      </p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        {stats.totalTriples === 0 && (
          <p data-testid="empty-model" className="text-[var(--color-text-muted)]">
            This workspace has no published model yet — add your first Process in the
            Constitution, then publish a version.
          </p>
        )}
        <ul data-testid="kind-list" className="flex flex-col gap-[var(--space-1)]">
          {used.map((kind) => (
            <KindRow
              key={kind.id}
              label={kind.label}
              colour={kind.colour}
              count={stats.countsByKind[kind.id] ?? 0}
            />
          ))}
        </ul>
        {unusedCount > 0 && (
          <p data-testid="unused-kinds" className="text-[var(--color-text-muted)]">
            {unusedCount} kind{unusedCount === 1 ? "" : "s"} unused yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VersionRow({ version }: { version: VersionEntry }) {
  return (
    <li className="flex items-center justify-between gap-[var(--space-2)]">
      <span className="font-[family-name:var(--font-mono)] text-[var(--color-text-default)]">
        v{version.semver}
      </span>
      <div className="flex items-center gap-[var(--space-2)]">
        <Badge variant="success">Published</Badge>
        {version.published_at && <RelativeTimeSlot iso={version.published_at} />}
      </div>
    </li>
  );
}

function RecentVersionsCard({ versions }: { versions: VersionEntry[] }) {
  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Recent versions
      </p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        {versions.length === 0 ? (
          <p data-testid="no-versions" className="text-[var(--color-text-muted)]">
            No published versions yet — publish one from the Versions screen.
          </p>
        ) : (
          <ul data-testid="recent-versions" className="flex flex-col gap-[var(--space-2)]">
            {versions.map((version) => (
              <VersionRow key={version.version_iri} version={version} />
            ))}
          </ul>
        )}
        <Link
          href="/ce/versions"
          className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
        >
          See all versions →
        </Link>
      </CardContent>
    </Card>
  );
}

/** Rule/violation counts aren't wired to a summary read yet (that's a new
 * backend metric, out of scope here) -- a tasteful placeholder over a
 * fabricated number, same posture as `use-overview.ts`'s fail-soft reads. */
function RulesSummaryCard() {
  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Rules &amp; policies
      </p>
      <CardContent>
        <p data-testid="rules-placeholder" className="text-[var(--color-text-muted)]">
          Live rule and violation counts aren&apos;t available yet.
        </p>
        <Link
          href="/ce/rules"
          className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
        >
          Review rules &amp; policies →
        </Link>
      </CardContent>
    </Card>
  );
}

function QuickLinksCard() {
  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Jump into the model
      </p>
      <CardContent>
        <nav aria-label="Quick links" className="grid grid-cols-2 gap-[var(--space-2)]">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-accent-hover)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}

function OverviewBody({ stats }: { stats: OverviewStats }) {
  return (
    <>
      <KpiRow stats={stats} />
      <div className="grid gap-[var(--space-4)] md:grid-cols-2">
        <ModelByKindCard stats={stats} />
        <RecentVersionsCard versions={stats.recentVersions} />
      </div>
      <div className="grid gap-[var(--space-4)] md:grid-cols-2">
        <RulesSummaryCard />
        <QuickLinksCard />
      </div>
    </>
  );
}

/** The Constitution's landing page: model health at a glance plus quick
 * links into the rest of the engine (Types, Instances, Rules, Glossary,
 * Query, Explore). Entity authoring itself lives at `/ce/instances` (its
 * kind picker + guided form + chat aside already cover create/edit) -- this
 * screen is a thin read over CE-READ-1, same data source as before. */
export default function CePage() {
  const { stats, loadError } = useOverview();

  return (
    <main data-tour-id="ce.overview" className="flex flex-col gap-[var(--space-5)] p-[var(--space-6)]">
      <PageHeaderSlot
        eyebrow="Constitution"
        title="Overview"
        subtitle="The living knowledge graph of how your company operates."
      />

      <ExplainBand
        tone="accent"
        icon="graph"
        body={
          <>
            <b className="text-[var(--color-text-default)]">How the Constitution works:</b> model your
            processes, roles, systems and rules here, then publish a version to lock in a snapshot. Every
            change is tracked so anything built on the model can re-check itself.
          </>
        }
      />

      {loadError && !stats && (
        <p data-testid="overview-error" className="text-[var(--color-text-muted)]">
          Unable to load model stats from the backend.
        </p>
      )}

      {!loadError && !stats && (
        <p data-testid="overview-loading" className="text-[var(--color-text-muted)]">
          Loading model stats…
        </p>
      )}

      {stats && <OverviewBody stats={stats} />}
    </main>
  );
}

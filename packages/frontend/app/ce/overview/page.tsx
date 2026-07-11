"use client";

import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import { useOverview, type OverviewStats } from "./use-overview";

const QUICK_LINKS = [
  { label: "Explore", href: "/explorer" },
  { label: "Query", href: "/ce/query" },
  { label: "Instances", href: "/ce" },
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

function GlanceCard({ stats }: { stats: OverviewStats }) {
  const used = stats.kinds.filter((kind) => (stats.countsByKind[kind.id] ?? 0) > 0);
  const unusedCount = stats.kinds.length - used.length;

  return (
    <Card>
      {/* Plain text, not CardTitle -- same heading-order trap billing/page.tsx documents. */}
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Model at a glance
        {stats.publishedSemver && (
          <span data-testid="published-version" className="ml-[var(--space-2)] font-[var(--font-weight-regular)] text-[var(--color-text-muted)]">
            v{stats.publishedSemver}
          </span>
        )}
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
        <p data-testid="totals">
          Total: {stats.totalInstances} instances · {stats.totalTriples} triples loaded
        </p>
      </CardContent>
    </Card>
  );
}

/** Constitution overview -- model stats + health, a thin read over
 * CE-READ-1 (kind catalogue + latest triples counted client-side). */
export default function CeOverviewPage() {
  const { stats, loadError } = useOverview();

  return (
    <main data-tour-id="ce.overview" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Constitution overview
      </h1>

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

      {stats && <GlanceCard stats={stats} />}

      <nav aria-label="Quick links" className="flex gap-[var(--space-4)]">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)] hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

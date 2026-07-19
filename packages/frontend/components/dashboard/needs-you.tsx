"use client";

import Link from "next/link";

import { useRules } from "@/app/ce/rules/use-rules";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { usePendingGatesCount } from "./use-pending-gates-count";

const DOT_TONE: Record<"warn" | "danger", string> = {
  warn: "bg-[var(--color-warn)]",
  danger: "bg-[var(--color-danger)]",
};

function NeedsYouRow({
  tone,
  body,
  action,
  testId,
}: {
  tone: "warn" | "danger";
  body: React.ReactNode;
  action: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-start gap-[var(--space-2)] border-b border-[var(--color-border)] py-[var(--space-2)] text-[length:var(--text-body-sm)] last:border-b-0"
    >
      <span className={cn("mt-[6px] h-[7px] w-[7px] shrink-0 rounded-[var(--radius-full)]", DOT_TONE[tone])} />
      <div className="flex-1 text-[var(--color-text-muted)]">{body}</div>
      {action}
    </div>
  );
}

function gatesBody(loading: boolean, count: number | null): React.ReactNode {
  if (loading) return "Review gates — checking…";
  if (count === null || count === 0) {
    return (
      <>
        <strong className="text-[var(--color-text-default)]">Review gates</strong> — nothing waiting right now.
      </>
    );
  }
  return (
    <>
      <strong className="text-[var(--color-text-default)]">{count}</strong>{" "}
      {count === 1 ? "review gate" : "review gates"} waiting on you.
    </>
  );
}

function violationsBody(loading: boolean, error: boolean, violationCount: number | null): React.ReactNode {
  if (loading) return "Rule violations — checking…";
  if (error || violationCount === null) return "Rule violations — nothing to review yet.";
  return (
    <>
      <strong className="text-[var(--color-text-default)]">{violationCount}</strong>{" "}
      {violationCount === 1 ? "rule violation" : "rule violations"} found in the last SHACL run.
    </>
  );
}

function RowAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
      {label}
    </Link>
  );
}

/** v5 Home "Needs you": review-gates row is wired to G12's per-project
 * pending-gates feed via `usePendingGatesCount` (H4 --
 * `docs/design/remediation-2-api-gaps.md`), aggregated across the current
 * workspace's projects. Decisions has no distinct pending-action source:
 * G12's gate entries carry a single literal `gate: "hitl"` (no gate-type
 * split), and the separate `/api/projects/{id}/decisions` route is a past
 * decisions audit log, not a pending feed -- so that row stays static.
 * Rule violations are the other live feed -- CE-TASK-006's cache-only
 * `useRules()` (client-side, isolated fetch, same fail-soft posture as
 * every other Home tile). */
export function NeedsYou() {
  const { report, loading, error } = useRules();
  const { count: gatesCount, loading: gatesLoading } = usePendingGatesCount();
  const violationCount =
    report && !report.pending ? report.results.filter((entry) => entry.severity === "Violation").length : null;

  return (
    <section
      aria-label="Needs you"
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <h2 className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)]">
        <Icon name="bell" size={13} />
        <Eyebrow as="span">Needs you</Eyebrow>
      </h2>
      <NeedsYouRow
        tone="warn"
        testId="needs-you-gates"
        body={gatesBody(gatesLoading, gatesCount)}
        action={<RowAction href="/build/board" label="Browse" />}
      />
      <NeedsYouRow
        tone="danger"
        testId="needs-you-decisions"
        body={
          <>
            <strong className="text-[var(--color-text-default)]">Decisions</strong> — nothing waiting right now.
          </>
        }
        action={<RowAction href="/build/board" label="Browse" />}
      />
      <NeedsYouRow
        tone="danger"
        testId="needs-you-violations"
        body={violationsBody(loading, Boolean(error), violationCount)}
        action={<RowAction href="/ce/rules" label="Fix" />}
      />
    </section>
  );
}

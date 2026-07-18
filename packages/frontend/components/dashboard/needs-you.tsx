"use client";

import Link from "next/link";

import { useRules } from "@/app/ce/rules/use-rules";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

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

function violationsBody(loading: boolean, error: boolean, violationCount: number | null): React.ReactNode {
  if (loading) return "Rule violations — checking…";
  if (error || violationCount === null) return "Rule violations — pending (no cached SHACL report yet).";
  return (
    <>
      <strong className="text-[var(--color-text-default)]">{violationCount}</strong>{" "}
      {violationCount === 1 ? "rule violation" : "rule violations"} found in the last SHACL run.
    </>
  );
}

/** v5 Home "Needs you": gates and blocked decisions have no cross-workspace
 * feed yet (gap G12 -- `docs/design/remediation-2-api-gaps.md`), so those two
 * rows render an honest pending note rather than fake per-project data.
 * Rule violations are the one feed that does exist -- CE-TASK-006's
 * cache-only `useRules()` (client-side, isolated fetch, same fail-soft
 * posture as every other Home tile). */
export function NeedsYou() {
  const { report, loading, error } = useRules();
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
        body={
          <>
            <strong className="text-[var(--color-text-default)]">Review gates</strong> — pending, no cross-workspace
            gate feed yet (gap G12).
          </>
        }
        action={
          <Link href="/build/board" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
            Browse
          </Link>
        }
      />
      <NeedsYouRow
        tone="danger"
        testId="needs-you-decisions"
        body={
          <>
            <strong className="text-[var(--color-text-default)]">Decisions needed</strong> — pending, same feed gap
            as review gates (gap G12).
          </>
        }
        action={
          <Link href="/build/board" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
            Browse
          </Link>
        }
      />
      <NeedsYouRow
        tone="danger"
        testId="needs-you-violations"
        body={violationsBody(loading, Boolean(error), violationCount)}
        action={
          <Link href="/ce/rules" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
            Fix
          </Link>
        }
      />
    </section>
  );
}

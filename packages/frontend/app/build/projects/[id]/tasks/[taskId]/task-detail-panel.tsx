"use client";

import { useState } from "react";

import { AuditTab } from "./audit-tab";
import { ConsoleTab } from "./console-tab";
import { TestsTab } from "./tests-tab";
import { useTaskDetail } from "./use-task-detail";

const TAB_NAMES = ["Brief", "Handoff", "Tests", "Console", "Audit"] as const;
type TabName = (typeof TAB_NAMES)[number];

function BriefPane({ brief }: { brief: Record<string, unknown> | null }) {
  if (brief === null) {
    return <p className="text-[var(--color-text-muted)]">No brief on file for this task.</p>;
  }
  return (
    <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-raised)] p-[var(--space-3)] font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-default)]">
      {JSON.stringify(brief, null, 2)}
    </pre>
  );
}

function HandoffPane({ handoff }: { handoff: Record<string, unknown>[] }) {
  if (handoff.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No predecessor handoff summaries.</p>;
  }
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {handoff.map((summary, i) => (
        <pre
          key={i}
          className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-raised)] p-[var(--space-3)] font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-default)]"
        >
          {JSON.stringify(summary, null, 2)}
        </pre>
      ))}
    </div>
  );
}

/** BE-V1-TASK-018 AC-2: the five-tab panel. Plain button-group tabs (no new
 * dependency) -- `role="tablist"`/`aria-selected` for a11y, tab switch is a
 * client-state flip (well under the 200ms budget, no re-fetch on switch). */
export function TaskDetailPanel({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}): React.JSX.Element {
  const [active, setActive] = useState<TabName>("Brief");
  const { detail, loading } = useTaskDetail(projectId, taskId);

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }
  if (detail === null) {
    return <p className="text-[var(--color-text-muted)]">Task not found.</p>;
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div role="tablist" aria-label="Task detail" className="flex gap-[var(--space-2)]">
        {TAB_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={active === name}
            data-testid={`task-tab-${name.toLowerCase()}`}
            onClick={() => setActive(name)}
            className={
              active === name
                ? "rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-bg)]"
                : "rounded-[var(--radius-full)] bg-[var(--color-raised)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]"
            }
          >
            {name}
          </button>
        ))}
      </div>
      <div role="tabpanel" data-testid={`task-panel-${active.toLowerCase()}`}>
        {active === "Brief" && <BriefPane brief={detail.brief} />}
        {active === "Handoff" && <HandoffPane handoff={detail.handoff} />}
        {active === "Tests" && <TestsTab projectId={projectId} taskId={taskId} />}
        {active === "Console" && (
          <ConsoleTab projectId={projectId} taskId={taskId} console={detail.console} />
        )}
        {active === "Audit" && <AuditTab projectId={projectId} taskId={taskId} />}
      </div>
    </div>
  );
}

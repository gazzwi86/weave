"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { HistoryStepOut, WidgetSpec } from "@/components/dashboard/types";

/** Implementation Hints: label is the prompt text truncated at ~60 chars,
 * full text on `title` for hover/a11y.
 */
function stepLabel(prompt: string): { label: string; title: string } {
  const label = prompt.length > 60 ? `${prompt.slice(0, 60)}…` : prompt;
  return { label, title: prompt };
}

async function fetchHistory(widgetId: string): Promise<HistoryStepOut[]> {
  const response = await fetch(`/api/dashboard/widgets/${widgetId}/history`);
  if (!response.ok) return [];
  const body = (await response.json()) as { steps: HistoryStepOut[] };
  return body.steps;
}

async function restoreStep(widgetId: string, seq: number): Promise<WidgetSpec | null> {
  const response = await fetch(`/api/dashboard/widgets/${widgetId}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seq }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { spec: WidgetSpec };
  return body.spec;
}

/** PLAT-V1-TASK-013 AC-4: lists refinement steps for a pinned widget;
 * selecting one restores it -- no model call (`POST .../restore` per the
 * API contract), only `GET .../history` + the restore POST.
 */
export function HistoryMenu({
  widgetId,
  onRestored,
}: {
  widgetId: string;
  onRestored: (spec: WidgetSpec) => void;
}) {
  const [steps, setSteps] = useState<HistoryStepOut[] | null>(null);

  async function toggle() {
    setSteps(steps === null ? await fetchHistory(widgetId) : null);
  }

  async function handleRestore(seq: number) {
    const spec = await restoreStep(widgetId, seq);
    if (spec) onRestored(spec);
  }

  return (
    <div className="mt-[var(--space-2)]">
      <Button type="button" onClick={toggle}>
        History
      </Button>
      {steps && steps.length > 0 && (
        <ul data-testid="refine-history-list" className="mt-[var(--space-2)] flex flex-col gap-[var(--space-1)]">
          {steps.map((step) => {
            const { label, title } = stepLabel(step.prompt);
            return (
              <li key={step.seq}>
                <button
                  type="button"
                  title={title}
                  onClick={() => handleRestore(step.seq)}
                  className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] underline"
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

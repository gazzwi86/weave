"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { HistoryMenu } from "@/components/dashboard/history-menu";
import { ERROR_COPY } from "@/components/dashboard/stream-status";
import type { WidgetSpec } from "@/components/dashboard/types";
import { useWidgetStream } from "@/lib/dashboard/use-widget-stream";

/** AC-3: dismissible error notice -- split out to keep `RefineBar` under
 * Law E's 50-line function cap.
 */
function RefineError({ errorState, reason }: { errorState: string; reason: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div data-testid="refine-bar-error" className="flex items-center gap-[var(--space-2)]">
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
        {ERROR_COPY[errorState] ?? reason}
      </p>
      <Button type="button" onClick={() => setDismissed(true)}>
        Dismiss
      </Button>
    </div>
  );
}

/** PLAT-V1-TASK-013 AC-1/AC-5: follow-up-prompt composer for an existing
 * widget. Reuses `useWidgetStream` (TASK-011/012's SSE consumer) pointed
 * at `/refine` instead of `/generate` -- same grammar, no second stream
 * parser (Design Decisions: "duplicating any of it is a review Blocker").
 *
 * AC-5: `widgetId` is optional, mirroring `ChangeViz`'s identical
 * unpinned-vs-pinned branch (TASK-012) -- absent means the widget hasn't
 * been persisted yet, so refine holds context client-side and makes no
 * network call at all (there is nothing server-side to refine against).
 */
export function RefineBar({
  widgetId,
  onRefined,
}: {
  widgetId?: string;
  onRefined?: (spec: WidgetSpec, rows: unknown[]) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const { state, generate } = useWidgetStream();

  useEffect(() => {
    if (state.status === "done") onRefined?.(state.spec, state.rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onRefined identity isn't the trigger, state.status is
  }, [state.status]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!widgetId || !prompt.trim()) return; // AC-5: unpinned -- no call
    generate(prompt.trim(), `/api/dashboard/widgets/${widgetId}/refine`);
  }

  return (
    <div className="mt-[var(--space-2)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-2)]">
        <label htmlFor="refine-bar-input" className="sr-only">
          Refine this widget
        </label>
        <div className="flex gap-[var(--space-2)]">
          <input
            id="refine-bar-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Refine e.g. “last 30 days instead”…"
            className="w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-transparent px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] outline-none focus-visible:ring-[var(--ring-focus)]"
          />
          <Button type="submit" disabled={state.status === "streaming"}>
            Refine
          </Button>
        </div>
        {state.status === "error" && (
          <RefineError errorState={state.errorState} reason={state.reason} />
        )}
      </form>
      {/* AC-4: history/restore only makes sense once a widget is persisted
       * -- same optional-`widgetId` gate as the refine form above. */}
      {widgetId && (
        <HistoryMenu widgetId={widgetId} onRestored={(spec) => onRefined?.(spec, [])} />
      )}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { ChangeViz } from "@/components/dashboard/change-viz";
import { renderWidgetValue } from "@/components/dashboard/widget-tile";
import type { ComponentType } from "@/components/dashboard/types";

import type { WidgetStreamState } from "@/lib/dashboard/use-widget-stream";

/** m2-delta.md §6: human copy for each closed SSE error state. Only
 * `provider_503` is retryable (transient); the rest name a real gate the
 * user's prompt hit, so "Try again" would just repeat the same result.
 */
const ERROR_COPY: Record<string, string> = {
  budget_cap: "Monthly generation budget reached for this workspace.",
  provider_503: "AI provider unavailable",
  source_not_ga: "That data source isn't available yet.",
  unsatisfiable: "Couldn't match that prompt to a widget shape. Try rephrasing.",
  unavailable: "Widget generation is unavailable right now.",
};

/** Done-state body: preview (reuses `WidgetTile`'s renderer, single source
 * of "how does component_type X render this value") plus the change-viz
 * menu (AC-5) -- `componentType`/`onComponentTypeChange` let the caller own
 * the pure client-side override so switching never re-fetches (Design
 * Decisions: change-viz is pure client re-render).
 */
function DoneStreamBody({
  state,
  componentType,
  onComponentTypeChange,
}: {
  state: Extract<WidgetStreamState, { status: "done" }>;
  componentType: ComponentType;
  onComponentTypeChange: (componentType: ComponentType) => void;
}) {
  const spec = { ...state.spec, component_type: componentType };
  return (
    <div>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {spec.title}
      </p>
      <p
        data-testid="prompt-bar-status"
        className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]"
      >
        Done · {spec.data_source_contracts[0]}
      </p>
      <div className="mt-[var(--space-2)]">{renderWidgetValue(componentType, state.rows[0])}</div>
      <div className="mt-[var(--space-2)]">
        <ChangeViz spec={spec} widgetId={state.widgetId} onChange={onComponentTypeChange} />
      </div>
    </div>
  );
}

function StreamingBody({ state }: { state: Extract<WidgetStreamState, { status: "streaming" }> }) {
  return (
    <div aria-busy>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {state.spec.title}
      </p>
      <p
        data-testid="prompt-bar-status"
        className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]"
      >
        Generating… · {state.spec.data_source_contracts[0]}
      </p>
    </div>
  );
}

function ErrorBody({
  state,
  onRetry,
}: {
  state: Extract<WidgetStreamState, { status: "error" }>;
  onRetry: () => void;
}) {
  return (
    <div>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
        {ERROR_COPY[state.errorState] ?? state.reason}
      </p>
      {state.errorState === "provider_503" && (
        <Button type="button" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Renders the streaming/done/error tail of the bar -- the only part of
 * `WidgetStreamState` this component cares about (m2-delta.md §6).
 */
export function StreamStatus({
  state,
  onRetry,
  componentType,
  onComponentTypeChange,
}: {
  state: WidgetStreamState;
  onRetry: () => void;
  componentType: ComponentType | null;
  onComponentTypeChange: (componentType: ComponentType) => void;
}) {
  if (state.status === "done") {
    return (
      <DoneStreamBody
        state={state}
        componentType={componentType ?? state.spec.component_type}
        onComponentTypeChange={onComponentTypeChange}
      />
    );
  }
  if (state.status === "streaming") return <StreamingBody state={state} />;
  if (state.status === "error") return <ErrorBody state={state} onRetry={onRetry} />;
  return null;
}

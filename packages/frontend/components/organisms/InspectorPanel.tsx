import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface InspectorPanelField {
  label: string;
  value: string;
}

export interface InspectorPanelProps {
  title: string;
  fields: InspectorPanelField[];
  /** Incoming/outgoing edges (TASK-031 AC-3) -- same label/value shape,
   * rendered as their own labelled section. */
  edges?: InspectorPanelField[];
  /** PROV-O history (AC-3). A literal `"unavailable"` string renders an
   * explicit "not available" message rather than an empty section --
   * see TASK-031-blocker.md: no CE-READ-1 read path currently exposes it. */
  history?: InspectorPanelField[] | "unavailable";
  /** Edit entry point / "view on canvas" link (AC-4/AC-5) -- caller-built
   * from `@/components/ui` primitives, rendered as-is. */
  actions?: ReactNode;
  loading?: boolean;
  className?: string;
}

function InspectorPanelSection({ heading, fields }: { heading: string; fields: InspectorPanelField[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-[var(--space-4)]">
      <p className="text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] text-[var(--color-text-muted)]">
        {heading}
      </p>
      <dl className="mt-[var(--space-2)] flex flex-col gap-[var(--space-3)]">
        {fields.map((field) => (
          <div key={`${heading}-${field.label}`}>
            <dt className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">{field.label}</dt>
            <dd className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function InspectorPanelHistory({ history }: { history: InspectorPanelProps["history"] }) {
  if (history === undefined) return null;
  if (history === "unavailable") {
    return (
      <p className="mt-[var(--space-4)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        History unavailable -- not exposed by the current read path.
      </p>
    );
  }
  return <InspectorPanelSection heading="History" fields={history} />;
}

function InspectorPanelBody({
  fields,
  edges,
  history,
  loading,
}: Pick<InspectorPanelProps, "fields" | "edges" | "history" | "loading">) {
  if (loading) {
    return (
      <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        Loading...
      </p>
    );
  }
  if (fields.length === 0 && !edges?.length) {
    return (
      <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        No properties.
      </p>
    );
  }
  return (
    <>
      <InspectorPanelSection heading="Properties" fields={fields} />
      <InspectorPanelSection heading="Edges" fields={edges ?? []} />
      <InspectorPanelHistory history={history} />
    </>
  );
}

/** Spotlight/detail side panel (`components.md` "Side panel / inspector"):
 * `--z-panel`, `--shadow-panel` left edge, full height. Extracted from
 * `components/explorer/side-panel.tsx`, which owns fetch/spotlight state. */
export function InspectorPanel({ title, fields, edges, history, actions, loading, className }: InspectorPanelProps) {
  return (
    <aside
      aria-busy={loading || undefined}
      className={cn(
        "z-[var(--z-panel)] w-80 rounded-[var(--radius-base)] border border-[var(--color-border)]",
        "bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]",
        className
      )}
    >
      <p className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {title}
      </p>
      <InspectorPanelBody fields={fields} edges={edges} history={history} loading={loading} />
      {actions && <div className="mt-[var(--space-5)] flex gap-[var(--space-2)]">{actions}</div>}
    </aside>
  );
}

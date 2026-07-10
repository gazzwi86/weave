import { cn } from "@/lib/utils";

export interface InspectorPanelField {
  label: string;
  value: string;
}

export interface InspectorPanelProps {
  title: string;
  fields: InspectorPanelField[];
  loading?: boolean;
  className?: string;
}

function InspectorPanelBody({ fields, loading }: Pick<InspectorPanelProps, "fields" | "loading">) {
  if (loading) {
    return (
      <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        Loading...
      </p>
    );
  }
  if (fields.length === 0) {
    return (
      <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        No properties.
      </p>
    );
  }
  return (
    <dl className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">{field.label}</dt>
          <dd className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Spotlight/detail side panel (`components.md` "Side panel / inspector"):
 * `--z-panel`, `--shadow-panel` left edge, full height. Extracted from
 * `components/explorer/side-panel.tsx`, which owns fetch/spotlight state. */
export function InspectorPanel({ title, fields, loading, className }: InspectorPanelProps) {
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
      <InspectorPanelBody fields={fields} loading={loading} />
    </aside>
  );
}

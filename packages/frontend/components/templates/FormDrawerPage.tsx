import type { ReactNode } from "react";

import { GlassPanel } from "@/components/organisms/GlassPanel";

export interface FormDrawerPageProps {
  title: string;
  /** Form fields, rendered as-is -- form state/validation lives in the app layer. */
  fields: ReactNode;
  actions: ReactNode;
  className?: string;
}

/** Right-edge form drawer shell (`components.md` "Glass vs flat": drawer is
 * an overlay surface, so it uses `GlassPanel`). Data-only props -- no form
 * state, validation, or submit logic lives here. */
export function FormDrawerPage({ title, fields, actions, className }: FormDrawerPageProps) {
  return (
    <GlassPanel className={className}>
      <p className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {title}
      </p>
      <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">{fields}</div>
      <div className="mt-[var(--space-5)] flex justify-end gap-[var(--space-2)]">{actions}</div>
    </GlassPanel>
  );
}

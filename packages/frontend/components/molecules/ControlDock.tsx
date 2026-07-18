import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ControlDockTab {
  id: string;
  label: string;
  icon: ReactNode;
  panel: ReactNode;
}

export interface ControlDockProps {
  tabs: ControlDockTab[];
  /** `null` -- no panel open. Controlled: the dock never opens/closes itself. */
  activeTab: string | null;
  /** Fired with the tab id to open, or `null` when the caller clicks the
   * already-open tab (mock's `dock-tabs` click handler toggles it shut). */
  onTabChange: (id: string | null) => void;
  className?: string;
}

/** refit-mock.html `.dock`/`.dock-tabs`/`.dock-panel` -- vertical glass tab
 * stack over the canvas, single-open accordion panel below it. */
export function ControlDock({ tabs, activeTab, onTabChange, className }: ControlDockProps) {
  const openTab = tabs.find((tab) => tab.id === activeTab);
  return (
    // ponytail: mock fixes a dock width; no matching token exists, and the
    // caller already controls placement/width via `className` (see stories).
    <div className={cn("flex flex-col gap-[var(--space-2)]", className)}>
      <div className="flex gap-[var(--space-1)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)] p-[var(--space-1)] shadow-[var(--shadow-overlay)] backdrop-blur-md">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id === activeTab ? null : tab.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-[var(--space-1)] rounded-[var(--radius-base)] px-[var(--space-1)] py-[var(--space-2)]",
              "text-[length:var(--text-caption)] text-[var(--color-text-muted)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
              "hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
              tab.id === activeTab && "bg-[var(--color-accent-soft)] text-[var(--color-accent-primary)]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      {openTab && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)] p-[var(--space-4)] shadow-[var(--shadow-overlay)] backdrop-blur-md">
          {openTab.panel}
        </div>
      )}
    </div>
  );
}

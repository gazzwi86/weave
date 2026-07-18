import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export interface TimelineEntryAction {
  label: string;
  onClick: () => void;
}

export interface TimelineEntry {
  id: string;
  version: string;
  timestamp: string;
  author: string;
  description: string;
  /** Highlights the dot + shows the "latest" badge. */
  latest?: boolean;
  actions?: TimelineEntryAction[];
  /** Extra content rendered below the actions row when present (e.g. an
   * inline diff or a gap note toggled open by an action) -- generalized
   * minimally for the Versions page's per-row "Diff" toggle. */
  expandedContent?: ReactNode;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

function TimelineDot({ latest }: { latest?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "z-[1] mt-[var(--space-1)] h-[var(--space-3)] w-[var(--space-3)] shrink-0 rounded-[var(--radius-full)] border-2",
        latest
          ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] shadow-[0_0_10px_var(--color-accent-soft)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
      )}
    />
  );
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:border-[var(--color-accent-primary)]">
      <div className="mb-[var(--space-1)] flex items-center gap-[var(--space-2)]">
        <span className="font-[var(--font-mono)] text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {entry.version}
        </span>
        {entry.latest && <Badge variant="success">latest</Badge>}
        <span className="ml-auto font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          {entry.timestamp} · {entry.author}
        </span>
      </div>
      <p className="mb-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{entry.description}</p>
      {entry.actions && entry.actions.length > 0 && (
        <div className="flex gap-[var(--space-2)]">
          {entry.actions.map((action, index) => (
            <Button key={`${action.label}-${index}`} type="button" variant="ghost" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {entry.expandedContent && <div className="mt-[var(--space-3)]">{entry.expandedContent}</div>}
    </div>
  );
}

/** refit-mock.html `.timeline`/`.tl-item`/`.tl-card` -- vertical connector
 * line (rendered as a border segment between dots, not an absolute-positioned
 * pseudo-element -- flex/grid keeps the line glued to arbitrary card
 * heights without hand-tuned pixel offsets) with a dot per entry, the latest
 * entry's dot carrying the accent glow. */
export function Timeline({ entries, className }: TimelineProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex gap-[var(--space-3)]">
          <div className="flex flex-col items-center">
            <TimelineDot latest={entry.latest} />
            {index < entries.length - 1 && (
              <div className="w-0.5 flex-1 rounded-[var(--radius-sm)] bg-[var(--color-border-strong)]" />
            )}
          </div>
          <div className="flex-1 pb-[var(--space-4)]">
            <TimelineCard entry={entry} />
          </div>
        </div>
      ))}
    </div>
  );
}

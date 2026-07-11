import { cn } from "@/lib/utils";

export interface CanvasToolbarTool {
  id: string;
  label: string;
}

export interface CanvasToolbarProps {
  tools: CanvasToolbarTool[];
  /** Currently active tool id (AC-4 "selected" state) -- undefined means none. */
  activeToolId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

/** Floating toolbar of graph-canvas tools, one may be active/selected. */
export function CanvasToolbar({ tools, activeToolId, onSelect, className }: CanvasToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      className={cn(
        "flex items-center gap-[var(--space-1)] rounded-[var(--radius-base)] border border-[var(--color-border)]",
        "bg-[var(--color-raised)] p-[var(--space-1)] shadow-[var(--shadow-1)]",
        className
      )}
    >
      {tools.map((tool) => {
        const isActive = tool.id === activeToolId;
        return (
          <button
            key={tool.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect?.(tool.id)}
            className={cn(
              "rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)]",
              "text-[length:var(--text-caption)] text-[var(--color-text-muted)]",
              "hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
              isActive && "bg-[var(--color-accent-soft)] text-[var(--color-accent-primary)]"
            )}
          >
            {tool.label}
          </button>
        );
      })}
    </div>
  );
}

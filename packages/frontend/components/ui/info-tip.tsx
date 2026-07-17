import { cn } from "@/lib/utils";

export interface InfoTipProps {
  title: string;
  body: string;
  how?: string;
  side?: "center" | "left";
  direction?: "down" | "up";
  className?: string;
}

/** refit-mock.html `.qtip`/`.qtip-pop` -- the "hand-holding" explainer
 * tooltip. Trigger is a small circled-`?` button (`cursor:help`); the
 * popover is always rendered (never conditionally mounted) so hover/focus
 * can toggle it with pure CSS -- no JS open-state, no flicker on fast
 * pointer movement. Accessible name is the tip's own title (the mock's
 * generic "What is this?" label would otherwise collide across an instance
 * with many tips on one page). */
export function InfoTip({ title, body, how, side = "center", direction = "down", className }: InfoTipProps) {
  return (
    <span className={cn("group relative ml-[var(--space-2)] inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={title}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[var(--radius-full)] border border-[var(--color-border-strong)]",
          "bg-[var(--color-raised)] text-[length:var(--text-caption)] font-[var(--font-weight-bold)] text-[var(--color-text-subtle)]",
          "cursor-help transition-[color,border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
          "group-hover:border-[var(--color-accent-primary)] group-hover:bg-[var(--color-accent-soft)] group-hover:text-[var(--color-accent-primary)]",
          "group-focus-within:border-[var(--color-accent-primary)] group-focus-within:bg-[var(--color-accent-soft)] group-focus-within:text-[var(--color-accent-primary)]"
        )}
      >
        ?
      </button>
      <span
        className={cn(
          "invisible absolute w-[var(--size-popover)] -translate-y-1 rounded-[var(--radius-base)] border border-[var(--color-border-strong)]",
          "bg-[var(--color-raised)] p-[var(--space-3)] text-left opacity-0 shadow-[var(--shadow-overlay)] backdrop-blur-md",
          "z-[var(--z-panel)] transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
          "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
          "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
          direction === "down" ? "top-[calc(100%+var(--space-2))]" : "bottom-[calc(100%+var(--space-2))]",
          // ponytail: mock offsets the "left" variant popover by a small
          // raw literal so its right edge clears the trigger; nearest
          // token step is --space-3, a couple of screen units off but
          // invisible at this scale.
          side === "center" ? "left-1/2 -translate-x-1/2" : "-right-[var(--space-3)] left-auto"
        )}
      >
        <span className="mb-[var(--space-1)] flex items-center gap-[var(--space-2)] text-[length:var(--text-body-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)]" />
          {title}
        </span>
        <span className="block text-[length:var(--text-caption)] leading-relaxed text-[var(--color-text-muted)]">{body}</span>
        {how && (
          <span className="mt-[var(--space-2)] block border-t border-[var(--color-border)] pt-[var(--space-2)] text-[length:var(--text-caption)] leading-relaxed text-[var(--color-text-subtle)]">
            {how}
          </span>
        )}
      </span>
    </span>
  );
}

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface AskBarProps {
  placeholder?: string;
  value?: string;
  loading?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
}

/** Inline natural-language ask row (submit-and-wait, not the Cmd-K overlay
 * -- that's the `CommandBar` organism). refit-mock.html `.ask-pill`: the
 * same brand-gradient border-box trick as `AppHeader`'s `CommandBarTrigger`
 * -- never `--gradient-accent`, that's reserved for the avatar. The input
 * is a bare `<input>` rather than the bordered `Input` atom: the pill
 * wrapper owns the border here, not the field itself. */
export function AskBar({ placeholder, value, loading, onChange, onSubmit, className }: AskBarProps) {
  return (
    <form
      className={cn(
        "flex items-center gap-[var(--space-2)] rounded-[var(--radius-full)] border border-transparent",
        "bg-[var(--color-raised)] py-[var(--space-2)] pr-[var(--space-2)] pl-[var(--space-4)]",
        "[background-image:linear-gradient(var(--color-raised),var(--color-raised)),var(--gradient-brand)] [background-origin:border-box] [background-clip:padding-box,border-box]",
        className
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Icon name="sparkles" size={16} className="shrink-0 text-[var(--color-accent-primary)]" />
      <input
        aria-label="Ask a question"
        placeholder={placeholder ?? "Ask about your graph..."}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={loading}
        className="w-full flex-1 border-none bg-transparent text-[length:var(--text-body)] text-[var(--color-text-default)] placeholder:text-[var(--color-text-subtle)] focus-visible:outline-none disabled:opacity-50"
      />
      <Button type="submit" loading={loading}>
        Ask
      </Button>
    </form>
  );
}

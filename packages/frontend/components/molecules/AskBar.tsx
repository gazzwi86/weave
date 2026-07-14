import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * -- that's the `CommandBar` organism). */
export function AskBar({ placeholder, value, loading, onChange, onSubmit, className }: AskBarProps) {
  return (
    <form
      className={cn("flex items-center gap-[var(--space-2)]", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Input
        aria-label="Ask a question"
        placeholder={placeholder ?? "Ask about your graph..."}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={loading}
      />
      <Button type="submit" loading={loading}>
        Ask
      </Button>
    </form>
  );
}

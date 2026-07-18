import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Validation-failed state: red border, exposed to AT via aria-invalid. */
  error?: boolean;
}

/** Multi-line text input — same tokenised border/radius/spacing/focus ring as `Input`. */
export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={error || undefined}
      className={cn(
        "w-full rounded-[var(--radius-sm)] border",
        error ? "border-[var(--color-danger)]" : "border-[var(--color-border)]",
        "bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)]",
        "text-[length:var(--text-body)] text-[var(--color-text-default)]",
        "placeholder:text-[var(--color-text-subtle)]",
        "transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] focus-visible:border-[var(--color-border-strong)]",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

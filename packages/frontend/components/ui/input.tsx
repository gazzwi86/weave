import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Validation-failed state (AC-4 "error"): red border, exposed to AT via aria-invalid. */
  error?: boolean;
}

/** Text input — tokenised border, radius, spacing, and focus ring. */
export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
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

import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Text input — tokenised border, radius, spacing, and focus ring. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)]",
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

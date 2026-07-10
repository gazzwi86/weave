import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Selected state (AC-4 "selected"): accent border + soft accent wash. */
  selected?: boolean;
}

/** Surface container — tokenised background, border, radius, padding. */
export function Card({ className, selected, ...props }: CardProps) {
  return (
    <div
      aria-selected={selected || undefined}
      className={cn(
        "rounded-[var(--radius-lg)] border p-[var(--space-4)]",
        selected
          ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)]",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-[var(--space-2)] text-[var(--color-text-muted)]",
        className
      )}
      {...props}
    />
  );
}

import { type VariantProps, cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Status badge. Meaning always rides on the text label, never colour alone
 * (WCAG 1.4.1) — every variant pairs a token colour with a required label.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center rounded-[var(--radius-full)]",
    "px-[var(--space-2)] py-[var(--space-1)]",
    "text-[length:var(--text-caption)] font-[var(--font-weight-medium)]",
  ].join(" "),
  {
    variants: {
      variant: {
        neutral: "bg-[var(--color-raised)] text-[var(--color-text-muted)]",
        success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
        warn: "bg-[var(--color-warn)]/10 text-[var(--color-warn)]",
        danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
        info: "bg-[var(--color-info)]/10 text-[var(--color-info)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

import { type VariantProps, cva } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Primary interactive control. Every colour/spacing/radius/motion value is a
 * design token (docs/standards/design/tokens.md) — never a literal hex/px.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-[var(--space-2)]",
    "rounded-[var(--radius-base)] px-[var(--space-4)] py-[var(--space-2)]",
    "text-[length:var(--text-body)] font-[var(--font-weight-semibold)]",
    "transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
    "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-accent-primary)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)]",
        secondary:
          "bg-[var(--color-surface)] text-[var(--color-text-default)] border border-[var(--color-border)] hover:bg-[var(--color-hover)]",
        danger: "bg-[var(--color-danger)] text-[var(--color-bg)] hover:opacity-90",
        ghost:
          "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows an inline spinner and disables the button (AC-4 "loading" state). */
  loading?: boolean;
}

export function Button({ className, variant, loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-[var(--space-3)] w-[var(--space-3)] animate-spin rounded-[var(--radius-full)] border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}

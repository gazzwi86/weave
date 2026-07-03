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
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}

import { type VariantProps, cva } from "class-variance-authority";
import type { ElementType, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Small uppercase overline label ("page kicker" / section eyebrow) matching
 * the signed-off mock's `.page-eyebrow` treatment. `tone="accent"` for page
 * kickers (e.g. "Home"), `tone="muted"` (default) for section/card headers.
 */
const eyebrowVariants = cva(
  [
    "text-[length:var(--text-overline)] font-[var(--font-weight-semibold)]",
    "uppercase tracking-[var(--text-overline-tracking)]",
  ].join(" "),
  {
    variants: {
      tone: {
        muted: "text-[var(--color-text-muted)]",
        accent: "text-[var(--color-accent-primary)]",
      },
    },
    defaultVariants: {
      tone: "muted",
    },
  }
);

export interface EyebrowProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof eyebrowVariants> {
  /** Element to render as, so callers keep correct heading semantics. */
  as?: ElementType;
}

export function Eyebrow({ className, tone, as: Component = "p", ...props }: EyebrowProps) {
  return <Component className={cn(eyebrowVariants({ tone }), className)} {...props} />;
}

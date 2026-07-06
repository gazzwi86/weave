import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Link styled as a CTA button — mirrors ui/button.tsx variants (tokens only). */
export function CtaLink({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "ghost";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-base)] px-[var(--space-4)] py-[var(--space-2)]",
        "text-[length:var(--text-body)] font-[var(--font-weight-semibold)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]",
        variant === "primary"
          ? "bg-[var(--color-accent-primary)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)]"
          : "border border-[var(--color-border)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
      )}
    >
      {children}
    </Link>
  );
}

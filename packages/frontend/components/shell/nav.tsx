"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { findSection, PRIMARY_NAV } from "./nav-items";

/** The six IA areas (poc-ia-proposal.md §1); the section owning the current
 * pathname (by prefix, e.g. /compliance -> Audit trail) carries
 * aria-current="page". */
export function Nav() {
  const pathname = usePathname();
  const activeSection = findSection(pathname);

  return (
    <nav
      aria-label="Primary"
      className="flex items-center gap-[var(--space-4)] px-[var(--space-4)]"
    >
      {PRIMARY_NAV.map((item) => {
        const isActive = item === activeSection;
        return (
          <Link
            key={item.href}
            href={item.href}
            // FAIL-4 (ui_verify/Lighthouse): prefetching routes that may not
            // exist yet fires RSC requests that 404 and log console errors,
            // tanking best-practices. Re-enable once every section route ships.
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-[length:var(--text-label)] font-[var(--font-weight-medium)]",
              "text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]",
              isActive && "text-[var(--color-text-default)]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

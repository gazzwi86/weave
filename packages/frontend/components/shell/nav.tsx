"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

/** AC-1: seven area links, active one carries aria-current="page". */
export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="flex items-center gap-[var(--space-4)] px-[var(--space-4)]"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            // FAIL-4 (ui_verify/Lighthouse): most areas have no route yet in
            // M1 -- prefetching them fires RSC requests that 404 and log
            // console errors, tanking best-practices. Re-enable per-item
            // once each engine ships its route.
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

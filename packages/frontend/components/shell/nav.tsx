"use client";

import { usePathname } from "next/navigation";

import { NavRail } from "@/components/organisms/NavRail";

import { findSection, PRIMARY_NAV } from "./nav-items";
import { RAIL_ICONS } from "./rail-icons";

/** The six IA areas (poc-ia-proposal.md §1) rendered as the v5 icon rail;
 * the section owning the current pathname (by prefix, e.g. /audit/compliance
 * -> Audit trail) carries aria-current="page". Presentation lives in the
 * `NavRail` organism -- this wrapper owns routing state and the account
 * footer badge only. */
export function Nav({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const activeSection = findSection(pathname);
  const initial = (userName ?? "").trim().charAt(0).toUpperCase() || "?";

  return (
    <NavRail
      items={PRIMARY_NAV.map((item) => ({
        label: item.label,
        href: item.href,
        icon: RAIL_ICONS[item.href] ?? null,
      }))}
      activeHref={activeSection?.href}
      footer={
        <span
          aria-hidden="true"
          className="mb-[var(--space-1)] flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-accent-soft)] text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] text-[var(--color-accent-primary)]"
        >
          {initial}
        </span>
      }
    />
  );
}

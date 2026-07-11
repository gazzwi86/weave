"use client";

import { usePathname } from "next/navigation";

import { NavRail } from "@/components/organisms/NavRail";
import { findSection, PRIMARY_NAV } from "./nav-items";

/** The six IA areas (poc-ia-proposal.md §1); the section owning the current
 * pathname (by prefix, e.g. /compliance -> Audit trail) carries
 * aria-current="page". Presentation lives in the TASK-026 `NavRail`
 * organism (AC-1) -- this wrapper owns routing state only. */
export function Nav() {
  const pathname = usePathname();
  const activeSection = findSection(pathname);

  return (
    <NavRail
      items={PRIMARY_NAV.map((item) => ({ label: item.label, href: item.href }))}
      activeHref={activeSection?.href}
    />
  );
}

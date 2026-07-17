"use client";

import { usePathname } from "next/navigation";

import { SecondarySidebar, type SecondarySidebarGroup } from "@/components/organisms/SecondarySidebar";
import { findSection, type SecondaryNavItem } from "./nav-items";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

function visibleItems(items: SecondaryNavItem[], role: string | null): SecondaryNavItem[] {
  return items.filter((item) => !item.adminOnly || role === "admin");
}

function toSidebarGroups(
  section: NonNullable<ReturnType<typeof findSection>>,
  role: string | null
): SecondarySidebarGroup[] {
  return section.groups.map((group) => ({
    heading: group.heading,
    items: visibleItems(group.items, role).map((item) => ({
      label: item.label,
      href: item.href,
      // feedback_no_phase_pills.md: one plain "soon" pill for anything not
      // shipped -- no M1/M2/v1.0/post-v1 jargon in the UI.
      tag: item.built ? undefined : "soon",
    })),
  }));
}

/** Section-scoped left sidebar (IA §3): grouped secondary nav for the
 * section owning the current pathname; nothing for rail-less sections
 * (Home) or when collapsed (the top-bar carries the expand affordance).
 * Presentation lives in the `SecondarySidebar` organism -- this wrapper
 * owns routing, RBAC filtering, and collapse persistence. */
export function SectionRail({ role }: { role: string | null }) {
  const pathname = usePathname();
  const section = findSection(pathname);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  if (!section || section.groups.length === 0 || collapsed) return null;

  return (
    <SecondarySidebar
      groups={toSidebarGroups(section, role)}
      activeHref={pathname}
      title={section.label}
      onCollapse={toggleCollapsed}
    />
  );
}

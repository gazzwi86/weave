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
      icon: item.icon,
      // feedback_no_phase_pills.md: one plain "soon" pill for anything not
      // shipped -- no M1/M2/v1.0/post-v1 jargon in the UI.
      tag: item.built ? undefined : "soon",
    })),
  }));
}

/** Section-scoped left sidebar (IA §3): grouped secondary nav for the
 * section owning the current pathname; nothing for rail-less sections
 * (Home). Stays mounted (width/opacity `collapsed` prop) rather than
 * unmounting on collapse, so the sidebar animates shut instead of
 * disappearing instantly -- the top-bar's expand button reappears in sync.
 * Presentation lives in the `SecondarySidebar` organism -- this wrapper
 * owns routing, RBAC filtering, and collapse persistence. */
export function SectionRail({ role }: { role: string | null }) {
  const pathname = usePathname();
  const section = findSection(pathname);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  if (!section || section.groups.length === 0) return null;

  return (
    <SecondarySidebar
      groups={toSidebarGroups(section, role)}
      activeHref={pathname}
      title={section.label}
      onCollapse={toggleCollapsed}
      collapsed={collapsed}
    />
  );
}

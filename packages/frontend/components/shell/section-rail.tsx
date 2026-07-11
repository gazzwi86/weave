"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { SecondarySidebar, type SecondarySidebarGroup } from "@/components/organisms/SecondarySidebar";
import { findSection, TAG_LABEL, type SecondaryNavItem } from "./nav-items";

const COLLAPSE_STORAGE_KEY = "weave.sectionRail.collapsed";

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** AC-1: collapse toggle persists across page loads. localStorage is
 * per-browser-profile, which stands in for "per-user" (PLAT-SETTINGS-1)
 * without a new backend surface -- this task adds no API (brief §API
 * Contracts: "No new endpoints"). useSyncExternalStore's getServerSnapshot
 * always reports "expanded" so SSR and the first client render agree --
 * no hydration mismatch -- then the real localStorage value takes over. */
function useCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true",
    () => false
  );

  const toggle = () => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new StorageEvent("storage"));
  };

  return [collapsed, toggle];
}

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
      tag: item.tag !== "built" ? TAG_LABEL[item.tag] : undefined,
    })),
  }));
}

/** Section-scoped left rail (IA §3): grouped secondary nav for the section
 * owning the current pathname; nothing for rail-less sections (Home).
 * Presentation lives in the TASK-026 `SecondarySidebar` organism (AC-1) --
 * this wrapper owns routing, RBAC filtering, and collapse persistence. */
export function SectionRail({ role }: { role: string | null }) {
  const pathname = usePathname();
  const section = findSection(pathname);
  const [collapsed, toggleCollapsed] = useCollapsed();

  if (!section || section.groups.length === 0) return null;

  return (
    <div className="flex shrink-0">
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={toggleCollapsed}
        className="w-[var(--space-5)] shrink-0 border-r border-[var(--color-border)] text-[length:var(--text-caption)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
      >
        {collapsed ? "»" : "«"}
      </button>
      {collapsed ? null : <SecondarySidebar groups={toSidebarGroups(section, role)} activeHref={pathname} />}
    </div>
  );
}

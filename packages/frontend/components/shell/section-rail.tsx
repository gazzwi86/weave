"use client";

import { usePathname } from "next/navigation";

import { SecondarySidebar, type SecondarySidebarGroup } from "@/components/organisms/SecondarySidebar";
import { findSection, type SecondaryNavItem } from "./nav-items";
import { useCurrentBuildProject } from "./use-current-build-project";
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

function projectScopedHref(projectIri: string, path: string): string {
  return `/build/projects/${encodeURIComponent(projectIri)}${path}`;
}

/** Appends the Build rail's dynamic "Current project" group (switcher +
 * the 6 project-scoped links) to the static "Projects" group. Returns the
 * static groups unchanged for every other section. */
function useBuildSidebarGroups(
  section: NonNullable<ReturnType<typeof findSection>>,
  role: string | null,
  pathname: string
): SecondarySidebarGroup[] {
  const staticGroups = toSidebarGroups(section, role);
  const isBuild = section.label === "Build";
  const { projects, currentProjectIri, setCurrentProjectIri } = useCurrentBuildProject(
    pathname,
    isBuild
  );

  if (!isBuild) return staticGroups;
  if (!currentProjectIri) return staticGroups;

  const links = [
    { label: "Dashboard", path: "" },
    { label: "Request studio", path: "/request" },
    { label: "Kanban", path: "/board" },
    { label: "Decision log", path: "/decisions" },
    // T6 placeholder: real graph/backend deferred, but the intent is
    // navigable now (docs/specs/features/T6_PROJECT_EXPLORER_SPEC.md).
    { label: "Model canvas", path: "/canvas" },
    { label: "Settings", path: "/settings" },
  ];

  return [
    ...staticGroups,
    {
      heading: "Current project",
      selector: (
        <select
          aria-label="Current project"
          value={currentProjectIri}
          onChange={(e) => setCurrentProjectIri(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
        >
          {projects.map((project) => (
            <option key={project.projectIri} value={project.projectIri}>
              {project.name}
            </option>
          ))}
        </select>
      ),
      items: links.map((link) => ({
        label: link.label,
        href: projectScopedHref(currentProjectIri, link.path),
      })),
    },
  ];
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
  // Unconditional hook call (rules-of-hooks) -- returns a no-op default
  // when there's no section to avoid a conditional-hook-call, cheap since
  // the fetch effect only fires once per mount either way.
  const buildGroups = useBuildSidebarGroups(
    section ?? { label: "", href: "", prefixes: [], groups: [] },
    role,
    pathname
  );

  if (!section || section.groups.length === 0) return null;

  return (
    <SecondarySidebar
      groups={buildGroups}
      activeHref={pathname}
      title={section.label}
      onCollapse={toggleCollapsed}
      collapsed={collapsed}
    />
  );
}

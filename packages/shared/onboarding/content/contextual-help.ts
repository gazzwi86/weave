import type { AreaId } from "../types";

export interface ContextualHelpLink {
  titleKey: string;
  href: string;
}

/**
 * ONB-TASK-013 AC-013-04: 2-4 links relevant to the active area, keyed by
 * `AreaId` (same phase-tag machinery as tours -- ADR-005/ADR-006). Areas with
 * no shipped M1 screen content are intentionally absent from this map so the
 * launcher hides the "Help for this page" section rather than showing an
 * empty box (E7-S2).
 */
export const CONTEXTUAL_HELP: Partial<Record<AreaId, ContextualHelpLink[]>> = {
  constitution: [
    { titleKey: "onboarding.launcher.help.constitution.overview", href: "/ce" },
    { titleKey: "onboarding.launcher.help.constitution.glossary", href: "/ce/glossary" },
    { titleKey: "onboarding.launcher.help.constitution.query", href: "/ce/query" },
  ],
  explorer: [
    { titleKey: "onboarding.launcher.help.explorer.canvas", href: "/explorer" },
    { titleKey: "onboarding.launcher.help.explorer.spotlight", href: "/explorer" },
  ],
};

/** Maps a route pathname to its onboarding `AreaId`; `null` when the area has
 * no contextual-help config (AC-013-04's hidden-when-none case). */
export function areaForPathname(pathname: string | null): AreaId | null {
  if (!pathname) return null;
  if (pathname.startsWith("/ce")) return "constitution";
  if (pathname.startsWith("/explorer")) return "explorer";
  if (pathname.startsWith("/build")) return "build";
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/compliance")) return "compliance";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/role-home")) return "role-home";
  return null;
}

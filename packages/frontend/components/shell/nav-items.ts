/** Approved PoC IA (docs/design/poc-ia-proposal.md §1–§2): exactly six
 * top-level areas, each with a section-scoped left rail.
 *
 * No milestone jargon in the UI (feedback_no_phase_pills.md, 2026-07-17
 * ruling): a shipped item (`built: true`) carries no pill at all; anything
 * else renders a single plain "soon" pill, regardless of which internal
 * milestone it's actually scheduled for.
 *
 * Existing green routes keep their URLs (/ce, /ce/query, /explorer,
 * /billing) — the IA re-homes them in the rail rather than moving them, so
 * the per-feature Playwright suites stay untouched. Exception: /compliance
 * moved to /audit/compliance (TASK-029 AC-6, additive redirect in
 * next.config.ts) to resolve a route-naming conflict with the design ruling.
 */

import type { IconName } from "@/components/ui/icon";

export interface SecondaryNavItem {
  label: string;
  /** Absent for phase placeholders — rendered dimmed with a "soon" pill, no route. */
  href?: string;
  built: boolean;
  /** Rendered only for workspace admins (RBAC display split, IA §5). */
  adminOnly?: boolean;
  /** Small stroke icon shown left of the label (refit-mock.html's per-item `i-*` icons). */
  icon: IconName;
}

export interface SecondaryNavGroup {
  heading: string;
  items: SecondaryNavItem[];
}

export interface PrimaryNavItem {
  label: string;
  href: string;
  /** Pathname prefixes owned by this section (drives active tab + rail). */
  prefixes: string[];
  groups: SecondaryNavGroup[];
  /** Whole IA area not yet built (e.g. Events) -- the rail icon renders
   * disabled with a "coming soon" tooltip instead of a link. */
  disabled?: boolean;
}

export const PRIMARY_NAV: PrimaryNavItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    prefixes: ["/dashboard", "/notifications", "/role-home"],
    groups: [
      {
        heading: "Home",
        items: [
          { label: "What can Weave do for you?", href: "/role-home", built: true, icon: "home" },
          { label: "Notifications", href: "/notifications", built: true, icon: "bell" },
        ],
      },
    ],
  },
  {
    label: "Constitution",
    href: "/ce",
    prefixes: ["/ce", "/explorer"],
    groups: [
      {
        heading: "Model",
        items: [
          { label: "Overview", href: "/ce", built: true, icon: "home" },
          { label: "Explore", href: "/explorer", built: true, icon: "graph" },
          { label: "Ontology / Types", href: "/ce/types", built: true, icon: "tag" },
          { label: "Instances / Data", href: "/ce/instances", built: true, icon: "table" },
        ],
      },
      {
        heading: "Query",
        items: [
          { label: "Query", href: "/ce/query", built: true, icon: "sparkles" },
          { label: "Versions", href: "/ce/versions", built: false, icon: "git" },
        ],
      },
      {
        heading: "Vocabulary & standards",
        items: [
          { label: "Glossary", href: "/ce/glossary", built: true, icon: "book" },
          { label: "Branding & standards", href: "/ce/brand", built: true, icon: "mic" },
          { label: "Rules & policies", href: "/ce/rules", built: true, icon: "shield" },
          { label: "Strategy & motivation", built: false, icon: "target" },
        ],
      },
      {
        heading: "Tools",
        items: [
          { label: "Ingest", href: "/ce/import", built: false, icon: "upload" },
          { label: "Reasoning", built: false, icon: "brain" },
        ],
      },
    ],
  },
  {
    label: "Build",
    href: "/build",
    prefixes: ["/build"],
    // refit-mock.html buildSidebarHTML(): a static "Projects" group
    // (Registry) plus a dynamic "Current project" group (switcher + the
    // 6 project-scoped links) -- the dynamic group is built at render
    // time by `section-rail.tsx` (`useCurrentBuildProject`), since it
    // needs the live project list + URL-derived current project id, data
    // this static config can't carry. This groups array is the fallback
    // used before that data loads / for any other consumer of `findSection`.
    groups: [
      {
        heading: "Projects",
        items: [{ label: "Registry", href: "/build", built: true, icon: "folder" }],
      },
    ],
  },
  {
    label: "Events",
    href: "/events",
    prefixes: ["/events"],
    disabled: true,
    groups: [
      {
        heading: "Automation",
        items: [
          { label: "Automations", href: "/events", built: false, icon: "zap" },
          { label: "Triggers", built: false, icon: "swap" },
          { label: "Runs", built: false, icon: "list" },
        ],
      },
    ],
  },
  {
    label: "Audit trail",
    href: "/audit",
    // AC-6: /audit/compliance is the canonical route (visual-direction.md
    // "Compliance placement"); /compliance is a legacy alias, additively
    // redirected (next.config.ts), so this prefix alone still highlights it.
    prefixes: ["/audit"],
    groups: [
      {
        heading: "Audit",
        items: [
          { label: "Dashboard", href: "/audit", built: true, icon: "gauge" },
          { label: "View logs", href: "/audit/logs", built: true, icon: "list" },
          { label: "Compliance", href: "/audit/compliance", built: true, icon: "shield" },
        ],
      },
      {
        heading: "Inference",
        items: [
          { label: "Sentiment", built: false, icon: "sparkles" },
          { label: "Intent & urgency", built: false, icon: "target" },
          { label: "Topics", built: false, icon: "tag" },
          { label: "Satisfaction", built: false, icon: "check" },
          { label: "Quality & safety", built: false, icon: "shield" },
          { label: "Model metrics", built: false, icon: "graph" },
        ],
      },
    ],
  },
  {
    label: "Settings",
    href: "/settings",
    prefixes: ["/settings", "/billing"],
    groups: [
      {
        heading: "Workspace",
        items: [
          { label: "General", href: "/settings", built: true, icon: "gear" },
          { label: "Members", href: "/settings/members", built: true, icon: "user" },
          { label: "Onboarding path", href: "/settings/onboarding-path", built: true, icon: "play" },
          { label: "Notifications", href: "/settings/notifications", built: true, icon: "bell" },
          { label: "Models & AI", href: "/settings/models", built: true, adminOnly: true, icon: "sparkles" },
          { label: "Billing & budgets", href: "/billing", built: true, icon: "scroll" },
          { label: "Integrations", href: "/settings/integrations", built: false, icon: "swap" },
        ],
      },
      {
        heading: "Provisioning",
        items: [
          {
            label: "Workspaces",
            href: "/settings/workspaces",
            built: true,
            adminOnly: true,
            icon: "layers",
          },
        ],
      },
    ],
  },
];

/** The section owning a pathname, or undefined (public/unknown routes). */
export function findSection(pathname: string): PrimaryNavItem | undefined {
  return PRIMARY_NAV.find((item) =>
    item.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

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

export interface SecondaryNavItem {
  label: string;
  /** Absent for phase placeholders — rendered dimmed with a "soon" pill, no route. */
  href?: string;
  built: boolean;
  /** Rendered only for workspace admins (RBAC display split, IA §5). */
  adminOnly?: boolean;
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
          { label: "What can Weave do for you?", href: "/role-home", built: true },
          { label: "Notifications", href: "/notifications", built: true },
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
          { label: "Overview", href: "/ce/overview", built: true },
          { label: "Explore", href: "/explorer", built: true },
          { label: "Ontology / Types", href: "/ce/types", built: true },
          { label: "Instances / Data", href: "/ce/instances", built: true },
        ],
      },
      {
        heading: "Query",
        items: [
          { label: "Query", href: "/ce/query", built: true },
          { label: "Versions", href: "/ce/versions", built: false },
        ],
      },
      {
        heading: "Vocabulary & standards",
        items: [
          { label: "Glossary", href: "/ce/glossary", built: true },
          { label: "Brand & voice", href: "/ce/brand", built: true },
          { label: "Rules & policies", href: "/ce/rules", built: true },
          { label: "Strategy & motivation", built: false },
        ],
      },
      {
        heading: "Tools",
        items: [
          { label: "Ingest", href: "/ce/import", built: false },
          { label: "Reasoning", built: false },
        ],
      },
    ],
  },
  {
    label: "Build",
    href: "/build",
    prefixes: ["/build"],
    groups: [
      {
        heading: "Build",
        items: [
          { label: "Registry", href: "/build", built: true },
          { label: "Dashboard", built: false },
          { label: "Kanban", href: "/build/board", built: true },
          { label: "Task briefs & decisions", built: false },
        ],
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
          { label: "Automations", href: "/events", built: false },
          { label: "Triggers", built: false },
          { label: "Runs", built: false },
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
          { label: "Dashboard", href: "/audit", built: true },
          { label: "View logs", href: "/audit/logs", built: true },
          { label: "Compliance", href: "/audit/compliance", built: true },
        ],
      },
      {
        heading: "Inference",
        items: [
          { label: "Sentiment", built: false },
          { label: "Intent & urgency", built: false },
          { label: "Topics", built: false },
          { label: "Satisfaction", built: false },
          { label: "Quality & safety", built: false },
          { label: "Model metrics", built: false },
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
          { label: "Members", href: "/settings/members", built: true },
          { label: "Onboarding path", href: "/settings/onboarding-path", built: true },
          { label: "Notifications", href: "/settings/notifications", built: true },
          { label: "Models & AI", href: "/settings/models", built: true },
          { label: "Billing & budgets", href: "/billing", built: true },
          { label: "Integrations", href: "/settings/integrations", built: false },
        ],
      },
      {
        heading: "Provisioning",
        items: [
          { label: "Workspaces", href: "/settings/workspaces", built: true, adminOnly: true },
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

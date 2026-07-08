/** Approved PoC IA (docs/design/poc-ia-proposal.md §1–§2): exactly six
 * top-level areas, each with a section-scoped left rail. Every surface
 * carries one of three status tags — built now / M1 this pass / phase X
 * placeholder — so the nav itself communicates the roadmap.
 *
 * Existing green routes keep their URLs (/ce, /ce/query, /explorer,
 * /compliance, /billing) — the IA re-homes them in the rail rather than
 * moving them, so the per-feature Playwright suites stay untouched.
 */

export type SurfaceTag = "built" | "m1" | "m2" | "v1.0" | "post-v1";

/** Short pill text per tag; placeholder pages spell out "Delivered in phase X". */
export const TAG_LABEL: Record<SurfaceTag, string> = {
  built: "built now",
  m1: "M1 — this pass",
  m2: "M2",
  "v1.0": "v1.0",
  "post-v1": "post-v1",
};

export interface SecondaryNavItem {
  label: string;
  /** Absent for phase placeholders — rendered dimmed with a phase pill, no route. */
  href?: string;
  tag: SurfaceTag;
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
}

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { label: "Home", href: "/dashboard", prefixes: ["/dashboard"], groups: [] },
  {
    label: "Constitution",
    href: "/ce",
    prefixes: ["/ce", "/explorer"],
    groups: [
      {
        heading: "Model",
        items: [
          { label: "Overview", href: "/ce/overview", tag: "built" },
          { label: "Explore", href: "/explorer", tag: "built" },
          { label: "Ontology / Types", href: "/ce/types", tag: "built" },
          { label: "Instances / Data", href: "/ce", tag: "built" },
        ],
      },
      {
        heading: "Query",
        items: [
          { label: "Query", href: "/ce/query", tag: "built" },
          { label: "Versions", href: "/ce/versions", tag: "m1" },
        ],
      },
      {
        heading: "Vocabulary & standards",
        items: [
          { label: "Glossary", tag: "m2" },
          { label: "Brand & voice", tag: "m2" },
          { label: "Rules & policies", tag: "m2" },
          { label: "Strategy & motivation", tag: "m2" },
        ],
      },
      {
        heading: "Tools",
        items: [
          { label: "Ingest", tag: "v1.0" },
          { label: "Reasoning", tag: "post-v1" },
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
          { label: "Request application", href: "/build", tag: "built" },
          { label: "Projects", tag: "v1.0" },
          { label: "Dashboard", tag: "v1.0" },
          { label: "Kanban", tag: "v1.0" },
          { label: "Task briefs & decisions", tag: "v1.0" },
        ],
      },
    ],
  },
  {
    label: "Events",
    href: "/events",
    prefixes: ["/events"],
    groups: [
      {
        heading: "Automation",
        items: [
          { label: "Automations", href: "/events", tag: "post-v1" },
          { label: "Triggers", tag: "post-v1" },
          { label: "Runs", tag: "post-v1" },
        ],
      },
    ],
  },
  {
    label: "Audit trail",
    href: "/audit",
    prefixes: ["/audit", "/compliance"],
    groups: [
      {
        heading: "Audit",
        items: [
          { label: "Dashboard", href: "/audit", tag: "built" },
          { label: "View logs", href: "/audit/logs", tag: "built" },
          { label: "Compliance", href: "/compliance", tag: "built" },
        ],
      },
      {
        heading: "Inference",
        items: [
          { label: "Sentiment", tag: "post-v1" },
          { label: "Intent & urgency", tag: "post-v1" },
          { label: "Topics", tag: "post-v1" },
          { label: "Satisfaction", tag: "post-v1" },
          { label: "Quality & safety", tag: "post-v1" },
          { label: "Model metrics", tag: "post-v1" },
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
          { label: "Models & AI", href: "/settings/models", tag: "built" },
          { label: "Billing & budgets", href: "/billing", tag: "built" },
          { label: "Integrations", tag: "v1.0" },
        ],
      },
      {
        heading: "Provisioning",
        items: [
          { label: "Workspaces", href: "/settings/workspaces", tag: "built", adminOnly: true },
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

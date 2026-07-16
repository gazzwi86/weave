import type { ReactNode } from "react";

/** Line icons for the primary icon rail, keyed by each IA area's `href`
 * (nav-items.ts). Hand-rolled inline SVG in the Lucide-style 24x24 / 1.75
 * stroke geometry (iconography.md) -- the repo inlines its SVGs (see the
 * NotificationCenter bell) rather than pulling an icon-font dependency. */
function svg(children: ReactNode) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const RAIL_ICONS: Record<string, ReactNode> = {
  // Home -- house
  "/dashboard": svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  // Constitution -- knowledge-graph node/edge motif
  "/ce": svg(
    <>
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="13" cy="18" r="2.4" />
      <path d="M8.1 8.3 11 16M8.3 7 15.7 6.3M16.2 8 13.7 15.7" />
    </>
  ),
  // Build -- layered grid
  "/build": svg(
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  // Events -- lightning bolt
  "/events": svg(<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" />),
  // Audit trail -- hash-chained log
  "/audit": svg(
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  // Settings -- gear
  "/settings": svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
    </>
  ),
};

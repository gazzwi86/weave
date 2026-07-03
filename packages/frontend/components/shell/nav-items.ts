/** AC-1: the seven fixed top-level areas. Most routes don't exist yet
 * (M1 is a placeholder shell) -- linking to them is intentional, they'll
 * 404 until each engine ships its own routes.
 */
export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Platform", href: "/dashboard" },
  { label: "Constitution Engine", href: "/ce" },
  { label: "Build Engine", href: "/build" },
  { label: "Events & Actions", href: "/events" },
  { label: "Graph Explorer", href: "/explorer" },
  { label: "Onboarding", href: "/onboarding" },
  { label: "Settings", href: "/settings" },
];

import { cn } from "@/lib/utils";

export interface NavRailItem {
  label: string;
  href: string;
}

export interface NavRailProps {
  items: NavRailItem[];
  /** The item whose href matches the current route (AC-4 "selected" state).
   * Dumb component -- the app layer resolves the active route, not this one. */
  activeHref?: string;
  className?: string;
}

/** Primary top-level navigation row (extracted from the stateful
 * `components/shell/nav.tsx`, which owns `usePathname`/routing). */
export function NavRail({ items, activeHref, className }: NavRailProps) {
  return (
    <nav aria-label="Primary" className={cn("flex items-center gap-[var(--space-4)]", className)}>
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-[length:var(--text-label)] font-[var(--font-weight-medium)]",
              "text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]",
              isActive && "text-[var(--color-text-default)]"
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface NavRailItem {
  label: string;
  href: string;
  /** Line icon glyph (24x24 inline SVG) -- the only visible content of the
   * icon-only button; `label` becomes the accessible name via `aria-label`. */
  icon: ReactNode;
}

export interface NavRailProps {
  items: NavRailItem[];
  /** The item whose href matches the current route (AC-4 "selected" state).
   * Dumb component -- the app layer resolves the active route, not this one. */
  activeHref?: string;
  /** Brand mark target -- the logo at the rail top links here. */
  logoHref?: string;
  /** Bottom-docked slot (account/workspace badge). */
  footer?: ReactNode;
  className?: string;
}

/** Primary top-level navigation as a fixed icon rail (v5 shell, width
 * `--size-rail`): a
 * brand mark, one icon-only button per IA area with a hover/focus tooltip
 * and an active-section accent bar, then a bottom footer slot. Icon-only
 * buttons carry an `aria-label` so they pass axe; the visible `.tip` tooltip
 * is `aria-hidden` (it would otherwise double the accessible name). */
function RailItem({ item, isActive }: { item: NavRailItem; isActive: boolean }) {
  return (
    <a
      href={item.href}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)]",
        "hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]",
        isActive && "bg-[var(--color-accent-soft)] text-[var(--color-accent-primary)]"
      )}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute -left-2 top-2 bottom-2 w-1 rounded-[var(--radius-sm)] bg-[var(--color-accent-primary)]"
        />
      ) : null}
      {item.icon}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-12 top-1/2 z-[var(--z-sticky)] -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] font-[var(--font-weight-medium)] text-[var(--color-text-default)] opacity-0 shadow-[var(--shadow-overlay)] transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {item.label}
      </span>
    </a>
  );
}

export function NavRail({ items, activeHref, logoHref = "/dashboard", footer, className }: NavRailProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex w-[var(--size-rail)] shrink-0 flex-col items-center gap-[var(--space-1)] border-r border-[var(--color-border)] bg-[var(--color-surface)] py-[var(--space-3)]",
        className
      )}
    >
      <a
        href={logoHref}
        aria-label="Weave home"
        className="mb-[var(--space-4)] flex h-8 w-8 items-center justify-center overflow-hidden rounded-[var(--radius-base)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark */}
        <img src="/logo.png" alt="" className="h-full w-full object-contain" />
      </a>

      {items.map((item) => (
        <RailItem key={item.href} item={item} isActive={item.href === activeHref} />
      ))}

      {footer ? (
        <>
          <div className="flex-1" />
          {footer}
        </>
      ) : null}
    </nav>
  );
}

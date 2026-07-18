import type { ReactNode } from "react";

import { LogoMark } from "@/components/ui/logo-mark";
import { cn } from "@/lib/utils";

export interface NavRailItem {
  label: string;
  href: string;
  /** Line icon glyph (24x24 inline SVG) -- the only visible content of the
   * icon-only button; `label` becomes the accessible name via `aria-label`. */
  icon: ReactNode;
  /** Renders as a dimmed, non-interactive item with a "coming soon" tooltip
   * instead of a link -- no milestone jargon, just plain disabled (Law:
   * feedback_no_phase_pills.md). */
  disabled?: boolean;
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
// Active indicator + tooltip stay mounted always and animate via a class
// swap (refit-mock.html .rail-item::before height/top transition) rather
// than mount/unmount, so the height/opacity changes actually transition.
// Width uses --space-1 -- the closest existing token to the mock's
// hard-coded bar width; not worth a one-off token for a sub-pixel diff.
function RailIndicator({ isActive }: { isActive: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -left-2 w-1 rounded-[var(--radius-sm)] bg-[var(--color-accent-primary)]",
        "transition-[height,top] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        isActive ? "top-2 h-6" : "top-1/2 h-0"
      )}
    />
  );
}

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-12 top-1/2 z-[var(--z-sticky)] -translate-y-1/2 -translate-x-1 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] font-[var(--font-weight-medium)] text-[var(--color-text-default)] opacity-0 shadow-[var(--shadow-overlay)]",
        "transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
      )}
    >
      {label}
    </span>
  );
}

function DisabledRailItem({ item }: { item: NavRailItem }) {
  const label = `${item.label} — coming soon`;
  return (
    <span
      role="button"
      aria-label={label}
      aria-disabled="true"
      tabIndex={0}
      className="group relative flex h-10 w-10 cursor-default items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-subtle)] opacity-40"
    >
      {item.icon}
      <RailTooltip label={label} />
    </span>
  );
}

function RailItem({ item, isActive }: { item: NavRailItem; isActive: boolean }) {
  if (item.disabled) {
    return <DisabledRailItem item={item} />;
  }

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
      <RailIndicator isActive={isActive} />
      {item.icon}
      <RailTooltip label={item.label} />
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
        className="mb-[var(--space-4)] flex h-8 w-8 items-center justify-center rounded-[var(--radius-base)]"
      >
        <LogoMark size={26} />
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

import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface SecondarySidebarItem {
  label: string;
  href?: string;
  /** Roadmap pill text (e.g. "M2", "post-v1") -- absent for shipped items. */
  tag?: string;
  /** Small stroke icon shown left of the label (refit-mock.html .sb-item). */
  icon?: IconName;
}

/** ONB-V1-TASK-003: the sidebar row whose `href` matches this literal gets
 * `data-tour-id="plat.role-home.nav-entry"`. Kept as a static string
 * (never `item.tourId`-style interpolation) because `audit-anchors.ts`'s
 * scanner is a literal-attribute regex, not a JSX evaluator -- a dynamic
 * prop would be invisible to it (ADR-005 two-way audit). */
const ROLE_HOME_NAV_ENTRY_HREF = "/role-home";

export interface SecondarySidebarGroup {
  heading: string;
  items: SecondarySidebarItem[];
  /** Optional control rendered above the group's items (e.g. Build's
   * "Current project" `<select>` switcher, refit-mock.html
   * buildSidebarHTML) -- a plain slot, no Build-specific knowledge here. */
  selector?: ReactNode;
}

export interface SecondarySidebarProps {
  groups: SecondarySidebarGroup[];
  activeHref?: string;
  /** Section name shown in the sidebar head (v5 shell). Omit for no head. */
  title?: string;
  /** Collapse control in the head; the button is omitted when absent. */
  onCollapse?: () => void;
  /** Width/opacity transition to zero instead of unmounting, so the collapse
   * animates (refit-mock.html) and the header's expand button has a stable
   * target. Collapsed content is `inert` + `aria-hidden` -- present for the
   * transition but out of the tab order and accessibility tree. */
  collapsed?: boolean;
  className?: string;
}

function RowIcon({ icon }: { icon?: IconName }) {
  if (!icon) return null;
  return <Icon name={icon} size={15} className="shrink-0 text-[var(--color-text-subtle)]" />;
}

function SidebarRow({ item, isActive }: { item: SecondarySidebarItem; isActive: boolean }) {
  const rowClass =
    "flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]";
  const labelRow = (
    <span className="flex flex-1 items-center gap-[var(--space-2)]">
      <RowIcon icon={item.icon} />
      <span className="flex-1">{item.label}</span>
      {item.tag ? <span className="text-[length:var(--text-caption)]">{item.tag}</span> : null}
    </span>
  );

  if (!item.href) {
    return <li className={cn(rowClass, "text-[var(--color-text-muted)]")}>{labelRow}</li>;
  }

  // refit-mock.html .sb-item.active: accent-soft background + accent text,
  // not the neutral "raised" surface plain hover/selected rows use.
  const linkClassName = cn(
    rowClass,
    "text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
    isActive && "bg-[var(--color-accent-soft)] text-[var(--color-accent-primary)]"
  );

  // ADR-008: only the role-home entry plants an anchor -- a literal branch
  // (see ROLE_HOME_NAV_ENTRY_HREF) rather than an interpolated attribute.
  if (item.href === ROLE_HOME_NAV_ENTRY_HREF) {
    return (
      <li>
        <a href={item.href} aria-current={isActive ? "page" : undefined} data-tour-id="plat.role-home.nav-entry" className={linkClassName}>
          {labelRow}
        </a>
      </li>
    );
  }

  return (
    <li>
      <a href={item.href} aria-current={isActive ? "page" : undefined} className={linkClassName}>
        {labelRow}
      </a>
    </li>
  );
}

function SidebarHead({ title, onCollapse }: { title?: string; onCollapse?: () => void }) {
  if (!title && !onCollapse) return null;
  return (
    <div className="mb-[var(--space-3)] flex items-center justify-between px-[var(--space-2)]">
      {title ? (
        <span className="text-[length:var(--text-label)] font-[var(--font-weight-semibold)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)]">
          {title}
        </span>
      ) : null}
      {onCollapse ? (
        <button
          type="button"
          aria-label="Collapse sidebar"
          title="Hide sidebar (⌘\)"
          onClick={onCollapse}
          className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
        >
          <Icon name="panel-close" size={17} />
        </button>
      ) : null}
    </div>
  );
}

function SidebarGroup({ group, activeHref }: { group: SecondarySidebarGroup; activeHref?: string }) {
  return (
    <div className="mb-[var(--space-4)]">
      <p className="px-[var(--space-2)] pb-[var(--space-1)] text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] uppercase text-[var(--color-text-muted)]">
        {group.heading}
      </p>
      {group.selector ? <div className="px-[var(--space-2)] pb-[var(--space-2)]">{group.selector}</div> : null}
      <ul className="flex flex-col gap-[var(--space-1)]">
        {group.items.map((item) => (
          <SidebarRow key={item.label} item={item} isActive={item.href === activeHref} />
        ))}
      </ul>
    </div>
  );
}

/** Section-scoped left rail (extracted from the stateful
 * `components/shell/section-rail.tsx`, which owns `usePathname` + RBAC filtering). */
export function SecondarySidebar({
  groups,
  activeHref,
  title,
  onCollapse,
  collapsed = false,
  className,
}: SecondarySidebarProps) {
  return (
    <nav
      aria-label="Secondary"
      aria-hidden={collapsed || undefined}
      inert={collapsed || undefined}
      className={cn(
        "shrink-0 overflow-hidden overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] py-[var(--space-4)]",
        "transition-[width,opacity] duration-[var(--duration-base)] ease-[var(--ease-standard)]",
        collapsed ? "w-0 px-0 opacity-0" : "w-[var(--size-sidebar)] px-[var(--space-3)] opacity-100",
        className
      )}
    >
      <SidebarHead title={title} onCollapse={onCollapse} />
      {groups.map((group) => (
        <SidebarGroup key={group.heading} group={group} activeHref={activeHref} />
      ))}
    </nav>
  );
}
